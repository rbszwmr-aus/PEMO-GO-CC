package api

import (
	"context"
	"math"
	"sort"
	"strings"

	"pemo/internal/access"
	"pemo/internal/property"
)

func expandedContains(e property.ExpandedScope, n access.ScopeNode) bool {
	for _, id := range idsOfKind(e, n.Kind) {
		if id == n.ID {
			return true
		}
	}
	return false
}

func nk(kind, id string) string { return kind + ":" + id }

// nestedPreorder orders nodes parent-first, siblings by sequence then id;
// nodes whose parent is absent become roots.
func nestedPreorder(rows []property.TreeNodeRow) []property.TreeNodeRow {
	present := map[string]bool{}
	for _, r := range rows {
		present[nk(r.Kind, r.ID)] = true
	}
	children := map[string][]property.TreeNodeRow{}
	var roots []property.TreeNodeRow
	for _, r := range rows {
		if r.ParentKind != nil && r.ParentID != nil && present[nk(*r.ParentKind, *r.ParentID)] {
			k := nk(*r.ParentKind, *r.ParentID)
			children[k] = append(children[k], r)
			continue
		}
		roots = append(roots, r)
	}
	order := func(list []property.TreeNodeRow) {
		sort.SliceStable(list, func(i, j int) bool {
			a, b := list[i], list[j]
			if a.Sequence != b.Sequence {
				return a.Sequence < b.Sequence
			}
			return a.ID < b.ID
		})
	}
	order(roots)
	for k := range children {
		order(children[k])
	}
	out := []property.TreeNodeRow{}
	seen := map[string]bool{}
	var walk func(n property.TreeNodeRow)
	walk = func(n property.TreeNodeRow) {
		k := nk(n.Kind, n.ID)
		if seen[k] {
			return
		}
		seen[k] = true
		out = append(out, n)
		for _, c := range children[k] {
			walk(c)
		}
	}
	for _, r := range roots {
		walk(r)
	}
	for _, r := range rows {
		if !seen[nk(r.Kind, r.ID)] {
			out = append(out, r)
		}
	}
	return out
}

type treeNode struct {
	Kind, ID   string
	ParentKind string
	ParentID   string
	HasParent  bool
	Label      property.Bilingual
	Depth      int
	Sequence   *int64
	Counts     TreeNodeStat
	Permitted  []string
	HasPerm    bool
}

func (t treeNode) key() string { return nk(t.Kind, t.ID) }

func (t treeNode) json() O {
	var parent any
	if t.HasParent {
		parent = obj("kind", t.ParentKind, "id", t.ParentID)
	}
	o := obj("node", obj("kind", t.Kind, "id", t.ID), "parent", parent, "label", t.Label, "depth", t.Depth)
	o = o.when(t.Sequence != nil, "sequence", t.Sequence)
	o = o.with("counts", t.Counts)
	return o.when(t.HasPerm, "permittedActions", t.Permitted)
}

func mapHierarchy(r property.TreeNodeRow) treeNode {
	seq := r.Sequence
	t := treeNode{Kind: r.Kind, ID: r.ID, Label: r.Label, Depth: r.Depth, Sequence: &seq}
	if r.ParentKind != nil && r.ParentID != nil {
		t.HasParent, t.ParentKind, t.ParentID = true, *r.ParentKind, *r.ParentID
	}
	return t
}

var locationDepth = map[string]int{"estate": 2, "phase": 2, "building": 3, "floor": 4, "location": 3}

func mapLocation(l property.LocationRecord) treeNode {
	t := treeNode{Kind: "location", ID: l.LocationID, Label: l.Name, HasParent: true}
	if l.ParentLocationID != nil && *l.ParentLocationID != "" {
		t.ParentKind, t.ParentID, t.Depth = "location", *l.ParentLocationID, 3
	} else {
		t.ParentKind, t.ParentID = l.PhysicalParentType, l.PhysicalParentID
		d, ok := locationDepth[l.PhysicalParentType]
		if !ok {
			d = 2
		}
		t.Depth = d
	}
	return t
}

func (s *Server) noticeCaller(ctx context.Context, sc *StaffContext) (access.CallerScopes, error) {
	es, err := s.roleScope(ctx, sc, "estate_staff")
	if err != nil {
		return nil, err
	}
	ap, err := s.roleScope(ctx, sc, "approver")
	if err != nil {
		return nil, err
	}
	return access.CallerScopes{"estate_staff": es, "approver": ap}, nil
}

func scopeGrantNodes(sc *StaffContext) []property.ScopeNode { return grantNodes(sc.Scope.Grants) }

func (s *Server) composeScopeTree(ctx context.Context, sc *StaffContext, p PageParams) (any, error) {
	e, err := s.prop.Expand(ctx, sc.OrganizationID, scopeGrantNodes(sc))
	if err != nil {
		return nil, err
	}
	hier, err := s.prop.NodesInScope(ctx, e)
	if err != nil {
		return nil, err
	}
	locIDs := append([]string{}, e.LocationIDs...)
	sort.Strings(locIDs)
	bare := []treeNode{}
	for _, r := range nestedPreorder(hier) {
		bare = append(bare, mapHierarchy(r))
	}
	keys := []string{}
	for _, b := range bare {
		keys = append(keys, b.key())
	}
	for _, id := range locIDs {
		keys = append(keys, "location:"+id)
	}
	pageKeys, meta, err := slicePage(keys, func(k string) string { return k }, p)
	if err != nil {
		return nil, err
	}
	var pageLoc []string
	keySet := map[string]bool{}
	for _, k := range pageKeys {
		keySet[k] = true
		if strings.HasPrefix(k, "location:") {
			pageLoc = append(pageLoc, strings.TrimPrefix(k, "location:"))
		}
	}
	locs := []property.LocationRecord{}
	if len(pageLoc) > 0 {
		if locs, err = s.prop.GetLocations(ctx, sc.OrganizationID, pageLoc); err != nil {
			return nil, err
		}
	}
	byID := map[string]property.LocationRecord{}
	for _, l := range locs {
		byID[l.LocationID] = l
	}
	nodes := []treeNode{}
	for _, b := range bare {
		if keySet[b.key()] {
			nodes = append(nodes, b)
		}
	}
	for _, id := range pageLoc {
		if l, ok := byID[id]; ok {
			nodes = append(nodes, mapLocation(l))
		}
	}
	caller, err := s.noticeCaller(ctx, sc)
	if err != nil {
		return nil, err
	}
	stats, err := s.computeTreeNodeStats(ctx, e.UnitIDs, sc.Now)
	if err != nil {
		return nil, err
	}
	out := []O{}
	for _, n := range nodes {
		n.Counts = stats[n.key()]
		n.Permitted, err = noticeActRegistry.Permitted(ctx, access.ActTarget{Kind: "node", NodeKey: n.key()}, caller)
		if err != nil {
			return nil, err
		}
		n.HasPerm = true
		out = append(out, n.json())
	}
	grants := []O{}
	for _, g := range sc.Scope.Grants {
		grants = append(grants, obj("kind", g.Node.Kind, "id", g.Node.ID))
	}
	return obj("meta", s.managementMeta(sc), "grants", grants, "nodes", out, "page", meta), nil
}

func (s *Server) composePropertyTree(ctx context.Context, sc *StaffContext, req *access.ScopeNode, p PageParams) (any, error) {
	reqKey := ""
	if req != nil {
		reqKey = req.Kind + ":" + req.ID
	}
	fp := treeWalkFingerprint(sc.PrincipalID, sc.OrganizationID, authorizationFingerprint(sc.Scope.Grants), reqKey)
	if p.After != nil {
		if cached, ok := takeTreeWalk(fp); ok {
			nodes := cached.([]O)
			page, meta, err := slicePage(nodes, treeKeyOf, p)
			if err != nil {
				return nil, err
			}
			return obj("meta", s.managementMeta(sc), "nodes", page, "page", meta), nil
		}
	}
	union, err := s.prop.Expand(ctx, sc.OrganizationID, scopeGrantNodes(sc))
	if err != nil {
		return nil, err
	}
	e := union
	if req != nil {
		if !expandedContains(union, *req) {
			return nil, staffProblems.ScopeNotFound()
		}
		if e, err = s.prop.Expand(ctx, sc.OrganizationID, []property.ScopeNode{{Kind: req.Kind, ID: req.ID}}); err != nil {
			return nil, err
		}
	}
	hier, err := s.prop.NodesInScope(ctx, e)
	if err != nil {
		return nil, err
	}
	caller, err := s.noticeCaller(ctx, sc)
	if err != nil {
		return nil, err
	}
	stats, err := s.computeTreeNodeStats(ctx, e.UnitIDs, sc.Now)
	if err != nil {
		return nil, err
	}
	all := []O{}
	for _, r := range nestedPreorder(hier) {
		n := mapHierarchy(r)
		n.Counts = stats[n.key()]
		if n.Permitted, err = noticeActRegistry.Permitted(ctx, access.ActTarget{Kind: "node", NodeKey: n.key()}, caller); err != nil {
			return nil, err
		}
		n.HasPerm = true
		all = append(all, n.json())
	}
	rememberTreeWalk(fp, all)
	page, meta, err := slicePage(all, treeKeyOf, p)
	if err != nil {
		return nil, err
	}
	return obj("meta", s.managementMeta(sc), "nodes", page, "page", meta), nil
}

func treeKeyOf(o O) string {
	n := o.get("node").(O)
	return n.get("kind").(string) + ":" + n.get("id").(string)
}

// ---- overview ----

const safetyWindowHours = 24

func (s *Server) resolveOverviewScope(ctx context.Context, sc *StaffContext, req *access.ScopeNode) ([]string, []string, error) {
	union, err := s.prop.Expand(ctx, sc.OrganizationID, scopeGrantNodes(sc))
	if err != nil {
		return nil, nil, err
	}
	e := union
	if req != nil {
		if !expandedContains(union, *req) {
			return nil, nil, staffProblems.ScopeNotFound()
		}
		if e, err = s.prop.Expand(ctx, sc.OrganizationID, []property.ScopeNode{{Kind: req.Kind, ID: req.ID}}); err != nil {
			return nil, nil, err
		}
	}
	return e.UnitIDs, expandedNodeKeys(e), nil
}

func (s *Server) composeOverview(ctx context.Context, sc *StaffContext, req *access.ScopeNode) (any, error) {
	units, keys, err := s.resolveOverviewScope(ctx, sc, req)
	if err != nil {
		return nil, err
	}
	live, err := s.notices.List(ctx, sc.OrganizationID, keys, []string{"live"}, nil)
	if err != nil {
		return nil, err
	}
	events, err := s.hs.SafetyEventsInWindow(ctx, units, safetyWindowHours)
	if err != nil {
		return nil, err
	}
	res, err := s.prop.ResidentialUnitsInScope(ctx, units)
	if err != nil {
		return nil, err
	}
	rids := make([]string, len(res))
	for i, u := range res {
		rids[i] = u.UnitID
	}
	unknown, err := s.hs.UnitsInUnknownState(ctx, rids)
	if err != nil {
		return nil, err
	}
	counters := []O{
		obj("key", "notices-active", "value", len(live), "label", lz("Live now", "現正生效")),
		obj("key", "safety-events-window", "value", len(events), "label", lz("Safety events (24h)", "安全事件（24小時）"), "windowHours", safetyWindowHours),
		obj("key", "units-unknown-state", "value", len(unknown), "label", lz("Units in unknown state", "狀態未明單位"),
			"basis", obj("includesSeverities", []string{"unknown", "offline"}, "deduplicatedByUnit", true)),
	}
	recent := []O{}
	for i, n := range live {
		if i >= 5 {
			break
		}
		recent = append(recent, obj("noticeId", n.NoticeID, "type", n.NoticeType, "title", lz(n.TitleEn, n.TitleZhHant), "state", n.LifecycleState))
	}
	return obj("meta", s.managementMeta(sc), "counters", counters, "recentNotices", recent), nil
}

var _ = math.MaxInt
