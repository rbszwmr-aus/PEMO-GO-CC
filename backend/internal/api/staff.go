package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"pemo/internal/access"
	"pemo/internal/property"
)

// StaffContext is the authenticated staff caller for one request.
type StaffContext struct {
	PrincipalID    string
	OrganizationID string
	CorrelationID  string
	Now            time.Time
	Scope          *access.ResolvedScope
}

func grantsOfRole(s *access.ResolvedScope, role string) []access.ScopeGrant {
	out := []access.ScopeGrant{}
	for _, g := range s.Grants {
		if g.Role == role {
			out = append(out, g)
		}
	}
	return out
}

var nodeDepth = map[string]int{"organization": 0, "portfolio": 1, "estate": 2, "phase": 3, "building": 4, "floor": 5, "unit": 6, "location": 7}

func idsOfKind(e property.ExpandedScope, kind string) []string {
	switch kind {
	case "organization":
		return e.OrganizationIDs
	case "portfolio":
		return e.PortfolioIDs
	case "estate":
		return e.EstateIDs
	case "phase":
		return e.PhaseIDs
	case "building":
		return e.BuildingIDs
	case "floor":
		return e.FloorIDs
	case "unit":
		return e.UnitIDs
	case "location":
		return e.LocationIDs
	}
	return nil
}

func depthOf(kind string) int {
	if d, ok := nodeDepth[kind]; ok {
		return d
	}
	return -1
}

// findAuthorizingGrant returns the narrowest grant whose expansion covers the
// target (deepest node kind wins; ties by grant id).
func (s *Server) findAuthorizingGrant(ctx context.Context, orgID string, grants []access.ScopeGrant, kind, id string) (*access.ScopeGrant, error) {
	var best *access.ScopeGrant
	for i := range grants {
		g := grants[i]
		e, err := s.prop.Expand(ctx, orgID, []property.ScopeNode{{Kind: g.Node.Kind, ID: g.Node.ID}})
		if err != nil {
			return nil, err
		}
		if !slices.Contains(idsOfKind(e, kind), id) {
			continue
		}
		if best == nil {
			best = &g
			continue
		}
		a, b := depthOf(g.Node.Kind), depthOf(best.Node.Kind)
		if a != b {
			if a > b {
				best = &g
			}
			continue
		}
		if g.GrantID < best.GrantID {
			best = &g
		}
	}
	return best, nil
}

func expandedNodeKeys(e property.ExpandedScope) []string {
	out := []string{}
	add := func(kind string, ids []string) {
		for _, id := range ids {
			out = append(out, kind+":"+id)
		}
	}
	add("organization", e.OrganizationIDs)
	add("portfolio", e.PortfolioIDs)
	add("estate", e.EstateIDs)
	add("phase", e.PhaseIDs)
	add("building", e.BuildingIDs)
	add("floor", e.FloorIDs)
	add("unit", e.UnitIDs)
	add("location", e.LocationIDs)
	return out
}

func toPropNodes(ns []access.ScopeNode) []property.ScopeNode {
	out := make([]property.ScopeNode, len(ns))
	for i, n := range ns {
		out[i] = property.ScopeNode{Kind: n.Kind, ID: n.ID}
	}
	return out
}

func grantNodes(gs []access.ScopeGrant) []property.ScopeNode {
	out := make([]property.ScopeNode, len(gs))
	for i, g := range gs {
		out[i] = property.ScopeNode{Kind: g.Node.Kind, ID: g.Node.ID}
	}
	return out
}

// expandToNodeKeys is the role-scope expansion port.
func (s *Server) expandToNodeKeys(orgID string) func(context.Context, []access.ScopeNode) ([]string, error) {
	return func(ctx context.Context, ns []access.ScopeNode) ([]string, error) {
		e, err := s.prop.Expand(ctx, orgID, toPropNodes(ns))
		if err != nil {
			return nil, err
		}
		return expandedNodeKeys(e), nil
	}
}

func (s *Server) roleScope(ctx context.Context, sc *StaffContext, role string) (*access.RoleScope, error) {
	return access.NewRoleScope(ctx, role, sc.Scope.Grants, s.expandToNodeKeys(sc.OrganizationID))
}

// ---- ?scope parsing ----

var scopeKinds = map[string]bool{"organization": true, "portfolio": true, "estate": true, "phase": true, "building": true, "floor": true, "unit": true, "location": true}

func scopeRef(kind, id *string) (*access.ScopeNode, bool) {
	if kind == nil && id == nil {
		return nil, true
	}
	if kind == nil || id == nil || *kind == "" || *id == "" || !scopeKinds[*kind] {
		return nil, false
	}
	return &access.ScopeNode{Kind: *kind, ID: *id}, true
}

func first(q url.Values, k string) *string {
	if v, ok := q[k]; ok && len(v) > 0 {
		return &v[0]
	}
	return nil
}

// parseScopeParam accepts scope[kind]&scope[id], or scope as a JSON object.
func parseScopeParam(q url.Values) (*access.ScopeNode, bool) {
	ref, ok := scopeRef(first(q, "scope[kind]"), first(q, "scope[id]"))
	if !ok || ref != nil {
		return ref, ok
	}
	nested := first(q, "scope")
	if nested == nil || *nested == "" {
		return nil, true
	}
	var obj map[string]any
	if err := json.Unmarshal([]byte(*nested), &obj); err != nil || obj == nil {
		return nil, false
	}
	str := func(k string) *string {
		if s, ok := obj[k].(string); ok {
			return &s
		}
		return nil
	}
	return scopeRef(str("kind"), str("id"))
}

// ---- paging ----

// Page sizes are configurable (review P3); defaults keep the Node behaviour
// so existing clients that read one page still see everything.
var (
	DefaultPageSize = envInt("PEMO_PAGE_DEFAULT", 2000)
	MaxPageSize     = envInt("PEMO_PAGE_MAX", 2000)
)

func envInt(k string, def int) int {
	if n, err := strconv.Atoi(os.Getenv(k)); err == nil && n > 0 {
		return n
	}
	return def
}

// PageParams is limit + cursor.
type PageParams struct {
	Limit int
	After *string
}

// PageMeta describes one page.
type PageMeta struct {
	Limit int     `json:"limit"`
	After *string `json:"after"`
	Next  *string `json:"next"`
	Total int     `json:"total"`
}

var errInvalidPageLimit = errors.New("limit must be a positive integer")

type cursorExpiredError struct{ After string }

func (e *cursorExpiredError) Error() string { return "cursor expired" }

var digitsRe = regexp.MustCompile(`^\d+$`)

func parsePageParams(q url.Values) (PageParams, error) {
	p := PageParams{Limit: DefaultPageSize}
	if raw := first(q, "limit"); raw != nil && *raw != "" {
		if !digitsRe.MatchString(*raw) {
			return p, errInvalidPageLimit
		}
		n, err := strconv.Atoi(*raw)
		if err != nil {
			n = MaxPageSize
		}
		if n < 1 {
			return p, errInvalidPageLimit
		}
		p.Limit = n
	}
	if p.Limit > MaxPageSize {
		p.Limit = MaxPageSize
	}
	if a := first(q, "after"); a != nil && strings.TrimSpace(*a) != "" {
		p.After = a
	}
	return p, nil
}

func slicePage[T any](rows []T, keyOf func(T) string, p PageParams) ([]T, PageMeta, error) {
	from := 0
	if p.After != nil {
		idx := -1
		for i, r := range rows {
			if keyOf(r) == *p.After {
				idx = i
				break
			}
		}
		if idx == -1 {
			return nil, PageMeta{}, &cursorExpiredError{*p.After}
		}
		from = idx + 1
	}
	end := from + p.Limit
	if end > len(rows) {
		end = len(rows)
	}
	sliced := append([]T{}, rows[from:end]...)
	var next *string
	if len(sliced) > 0 && end < len(rows) {
		k := keyOf(sliced[len(sliced)-1])
		next = &k
	}
	return sliced, PageMeta{p.Limit, p.After, next, len(rows)}, nil
}

// ---- meta ----

// ManagementMeta is the meta block of every management response.
type ManagementMeta struct {
	CorrelationID   string `json:"correlationId"`
	ContractVersion string `json:"contractVersion"`
	GeneratedAt     string `json:"generatedAt"`
}

func (s *Server) managementMeta(sc *StaffContext) ManagementMeta {
	// Seconds precision with the organisation's offset, like the Node build.
	l := sc.Now.In(s.cfg.TimeZone)
	return ManagementMeta{sc.CorrelationID, s.managementContract, l.Format("2006-01-02T15:04:05-07:00")}
}

// ---- tree stats ----

// TreeNodeStat is units / occupied / vacant under a node.
type TreeNodeStat struct {
	Units    int `json:"units"`
	Occupied int `json:"occupied"`
	Vacant   int `json:"vacant"`
}

func (s *Server) computeTreeNodeStats(ctx context.Context, unitIDs []string, asAt time.Time) (map[string]TreeNodeStat, error) {
	res, err := s.prop.ResidentialUnitsInScope(ctx, unitIDs)
	if err != nil {
		return nil, err
	}
	ids := make([]string, len(res))
	for i, u := range res {
		ids[i] = u.UnitID
	}
	occ, err := s.res.OccupantsOfUnits(ctx, ids, asAt)
	if err != nil {
		return nil, err
	}
	occupied := map[string]bool{}
	for _, o := range occ {
		occupied[o.UnitID] = true
	}
	stats := map[string]TreeNodeStat{}
	bump := func(k string, o bool) {
		st := stats[k]
		st.Units++
		if o {
			st.Occupied++
		} else {
			st.Vacant++
		}
		stats[k] = st
	}
	for _, u := range res {
		o := occupied[u.UnitID]
		bump("estate:"+u.EstateID, o)
		if u.PhaseID != nil && *u.PhaseID != "" {
			bump("phase:"+*u.PhaseID, o)
		}
		bump("building:"+u.BuildingID, o)
		bump("floor:"+u.FloorID, o)
		bump("unit:"+u.UnitID, o)
	}
	return stats, nil
}

// ---- tree walk cache ----
//
// Reuses one expanded tree across keyset pages of the same walk. A cache miss
// on another replica just recomputes, so it is safe with several instances.

const treeWalkTTL = 15 * time.Second

type walkEntry struct {
	nodes    any
	storedAt time.Time
}

var (
	walkMu sync.Mutex
	walks  = map[string]walkEntry{}
)

func authorizationFingerprint(gs []access.ScopeGrant) string {
	lines := make([]string, 0, len(gs))
	for _, g := range gs {
		to := ""
		if g.EffectiveTo != nil {
			to = *g.EffectiveTo
		}
		lines = append(lines, strings.Join([]string{g.Role, g.Node.Kind + ":" + g.Node.ID, g.EffectiveFrom, to, g.GrantID}, "\t"))
	}
	sort.Strings(lines)
	return strings.Join(lines, "\n")
}

func treeWalkFingerprint(principal, org, auth, requested string) string {
	return principal + "\x00" + org + "\x00" + auth + "\x00" + requested
}

func rememberTreeWalk(fp string, nodes any) {
	walkMu.Lock()
	defer walkMu.Unlock()
	now := time.Now()
	for k, e := range walks {
		if now.Sub(e.storedAt) > treeWalkTTL {
			delete(walks, k)
		}
	}
	walks[fp] = walkEntry{nodes, now}
}

func takeTreeWalk(fp string) (any, bool) {
	walkMu.Lock()
	defer walkMu.Unlock()
	e, ok := walks[fp]
	if !ok {
		return nil, false
	}
	if time.Since(e.storedAt) > treeWalkTTL {
		delete(walks, fp)
		return nil, false
	}
	return e.nodes, true
}
