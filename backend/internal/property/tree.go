package property

import (
	"context"
	"fmt"

	"pemo/internal/platform"
)

// TreeNodeRow is one hierarchy node in scope.
type TreeNodeRow struct {
	Kind       string
	ID         string
	ParentKind *string
	ParentID   *string
	Label      Bilingual
	Depth      int
	Sequence   int64
}

// ExpandedScope is a set of grants expanded to every covered node.
type ExpandedScope struct {
	OrganizationIDs []string `json:"organizationIds"`
	PortfolioIDs    []string `json:"portfolioIds"`
	EstateIDs       []string `json:"estateIds"`
	PhaseIDs        []string `json:"phaseIds"`
	BuildingIDs     []string `json:"buildingIds"`
	FloorIDs        []string `json:"floorIds"`
	UnitIDs         []string `json:"unitIds"`
	LocationIDs     []string `json:"locationIds"`
}

// EmptyScope has every list present and empty.
func EmptyScope() ExpandedScope {
	e := []string{}
	return ExpandedScope{e, e, e, e, e, e, e, e}
}

// NodesInScope reads every estate/building/floor/residential unit in scope.
func (p *Property) NodesInScope(ctx context.Context, s ExpandedScope) ([]TreeNodeRow, error) {
	rows, err := p.DB.Query(ctx, `
        SELECT 'estate'::text AS kind, e.estate_id AS id,
               NULL::text AS parent_kind, NULL::text AS parent_id,
               e.name_en AS label_en, e.name_zh_hant AS label_zh, 1 AS depth, e.sequence AS sequence
          FROM estate e WHERE e.estate_id = ANY($1::text[])
        UNION ALL
        SELECT 'building', b.building_id, 'estate', b.estate_id, b.name_en, b.name_zh_hant, 2, b.sequence
          FROM building b WHERE b.building_id = ANY($2::text[])
        UNION ALL
        SELECT 'floor', f.floor_id, 'building', f.building_id, f.label, f.label, 3, f.sequence
          FROM floor f WHERE f.floor_id = ANY($3::text[])
        UNION ALL
        SELECT 'unit', u.unit_id, 'floor', u.floor_id, u.label, u.label, 4, u.sequence
          FROM unit u WHERE u.unit_id = ANY($4::text[]) AND u.unit_class = 'residential'
        ORDER BY sequence, id`, nz(s.EstateIDs), nz(s.BuildingIDs), nz(s.FloorIDs), nz(s.UnitIDs))
	if err != nil {
		return nil, err
	}
	out := make([]TreeNodeRow, 0, len(rows))
	for _, r := range rows {
		out = append(out, TreeNodeRow{Kind: r.Str("kind"), ID: r.Str("id"), ParentKind: r.StrPtr("parent_kind"),
			ParentID: r.StrPtr("parent_id"), Label: Bilingual{En: r.Str("label_en"), ZhHant: r.Str("label_zh")},
			Depth: int(r.Int("depth")), Sequence: r.Int("sequence")})
	}
	return out, nil
}

func nz(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

// AttentionLeaf is a node that carries an attention marker.
type AttentionLeaf struct{ Kind, ID string }

// TreeRef is a node reference with its label.
type TreeRef struct {
	Kind  string    `json:"kind"`
	ID    string    `json:"id"`
	Label Bilingual `json:"label"`
}

// PropertyTreeNode is one rendered tree row.
type PropertyTreeNode struct {
	Node      TreeRef    `json:"node"`
	Parent    *TreeRef   `json:"parent"`
	Label     Bilingual  `json:"label"`
	Summary   *Bilingual `json:"summary,omitempty"`
	Attention bool       `json:"attention"`
	Depth     int        `json:"depth"`
}

// AttentionBearingIDs marks every leaf and its ancestors.
func AttentionBearingIDs(nodes []TreeNodeRow, leaves []AttentionLeaf) map[string]bool {
	parent := map[string]*string{}
	for _, n := range nodes {
		parent[n.ID] = n.ParentID
	}
	leafIDs := map[string]bool{}
	for _, l := range leaves {
		leafIDs[l.ID] = true
	}
	bearing := map[string]bool{}
	for _, n := range nodes {
		if !leafIDs[n.ID] {
			continue
		}
		cursor := &n.ID
		for cursor != nil && !bearing[*cursor] {
			bearing[*cursor] = true
			cursor = parent[*cursor]
		}
	}
	return bearing
}

// ExpandTree renders the nodes whose every ancestor is attention-bearing.
func ExpandTree(nodes []TreeNodeRow, leaves []AttentionLeaf, summaryFor func(TreeNodeRow) *Bilingual) ([]PropertyTreeNode, []AttentionLeaf) {
	bearing := AttentionBearingIDs(nodes, leaves)
	byID := map[string]TreeNodeRow{}
	for _, n := range nodes {
		byID[n.ID] = n
	}
	hidden := []AttentionLeaf{}
	for _, l := range leaves {
		if _, ok := byID[l.ID]; !ok {
			hidden = append(hidden, l)
		}
	}
	renders := func(n TreeNodeRow) bool {
		cursor := n.ParentID
		for cursor != nil {
			if !bearing[*cursor] {
				return false
			}
			p, ok := byID[*cursor]
			if !ok {
				cursor = nil
			} else {
				cursor = p.ParentID
			}
		}
		return true
	}
	tree := []PropertyTreeNode{}
	for _, n := range nodes {
		if !renders(n) {
			continue
		}
		t := PropertyTreeNode{Node: TreeRef{n.Kind, n.ID, n.Label}, Label: n.Label, Attention: bearing[n.ID], Depth: n.Depth - 1}
		if n.ParentID != nil && n.ParentKind != nil {
			label := Bilingual{En: *n.ParentID, ZhHant: *n.ParentID}
			if p, ok := byID[*n.ParentID]; ok {
				label = p.Label
			}
			t.Parent = &TreeRef{*n.ParentKind, *n.ParentID, label}
		}
		if s := summaryFor(n); s != nil {
			t.Summary = s
		}
		tree = append(tree, t)
	}
	return tree, hidden
}

// EstateCounts are an estate's block and residential-unit counts.
type EstateCounts struct{ Blocks, Units int64 }

// CountEstate counts one estate's blocks and residential units.
func (p *Property) CountEstate(ctx context.Context, estateID string) (EstateCounts, error) {
	r, err := p.DB.QueryOne(ctx, `SELECT
       (SELECT count(*) FROM building WHERE estate_id = $1) AS blocks,
       (SELECT count(*) FROM unit u JOIN floor f ON f.floor_id = u.floor_id
          JOIN building b ON b.building_id = f.building_id
         WHERE b.estate_id = $1 AND u.unit_class = 'residential') AS units`, estateID)
	if err != nil || r == nil {
		return EstateCounts{}, err
	}
	return EstateCounts{r.Int("blocks"), r.Int("units")}, nil
}

// FormatEstateSummary renders "2 blocks · 40 units" / "2座 · 40單位".
func FormatEstateSummary(c EstateCounts) Bilingual {
	b, u := "blocks", "units"
	if c.Blocks == 1 {
		b = "block"
	}
	if c.Units == 1 {
		u = "unit"
	}
	return Bilingual{En: fmt.Sprintf("%d %s · %d %s", c.Blocks, b, c.Units, u), ZhHant: fmt.Sprintf("%d座 · %d單位", c.Blocks, c.Units)}
}

// ResidentialUnitRow places a unit in its hierarchy.
type ResidentialUnitRow struct {
	UnitID, FloorID, BuildingID string
	PhaseID                     *string
	EstateID                    string
}

// ResidentialUnitsInScope places each residential unit of ids.
func (p *Property) ResidentialUnitsInScope(ctx context.Context, ids []string) ([]ResidentialUnitRow, error) {
	if len(ids) == 0 {
		return []ResidentialUnitRow{}, nil
	}
	rows, err := p.DB.Query(ctx, `SELECT u.unit_id, u.floor_id, f.building_id, b.phase_id, b.estate_id
         FROM unit u JOIN floor f ON f.floor_id = u.floor_id JOIN building b ON b.building_id = f.building_id
        WHERE u.unit_id = ANY($1::text[]) AND u.unit_class = 'residential'`, ids)
	if err != nil {
		return nil, err
	}
	out := make([]ResidentialUnitRow, 0, len(rows))
	for _, r := range rows {
		out = append(out, ResidentialUnitRow{r.Str("unit_id"), r.Str("floor_id"), r.Str("building_id"), r.StrPtr("phase_id"), r.Str("estate_id")})
	}
	return out, nil
}

const expandSQL = `
      WITH granted AS (SELECT unnest($2::text[]) AS kind, unnest($3::text[]) AS id),
      covered_estate AS (
        SELECT e.estate_id FROM estate e
         WHERE e.organization_id = $1
           AND (EXISTS (SELECT 1 FROM granted g WHERE g.kind = 'organization' AND g.id = $1)
             OR EXISTS (SELECT 1 FROM granted g WHERE g.kind = 'portfolio' AND g.id = e.portfolio_id)
             OR EXISTS (SELECT 1 FROM granted g WHERE g.kind = 'estate' AND g.id = e.estate_id))),
      covered_phase AS (
        SELECT p.phase_id FROM phase p JOIN estate e ON e.estate_id = p.estate_id
         WHERE e.organization_id = $1
           AND (p.estate_id IN (SELECT estate_id FROM covered_estate)
             OR EXISTS (SELECT 1 FROM granted g WHERE g.kind = 'phase' AND g.id = p.phase_id))),
      covered_building AS (
        SELECT b.building_id FROM building b JOIN estate e ON e.estate_id = b.estate_id
         WHERE e.organization_id = $1
           AND (b.estate_id IN (SELECT estate_id FROM covered_estate)
             OR b.phase_id IN (SELECT phase_id FROM covered_phase)
             OR EXISTS (SELECT 1 FROM granted g WHERE g.kind = 'building' AND g.id = b.building_id))),
      covered_floor AS (
        SELECT f.floor_id FROM floor f JOIN building b ON b.building_id = f.building_id
          JOIN estate e ON e.estate_id = b.estate_id
         WHERE e.organization_id = $1
           AND (f.building_id IN (SELECT building_id FROM covered_building)
             OR EXISTS (SELECT 1 FROM granted g WHERE g.kind = 'floor' AND g.id = f.floor_id))),
      covered_unit AS (
        SELECT u.unit_id FROM unit u JOIN floor f ON f.floor_id = u.floor_id
          JOIN building b ON b.building_id = f.building_id JOIN estate e ON e.estate_id = b.estate_id
         WHERE e.organization_id = $1
           AND (u.floor_id IN (SELECT floor_id FROM covered_floor)
             OR EXISTS (SELECT 1 FROM granted g WHERE g.kind = 'unit' AND g.id = u.unit_id))),
      loc_seed AS (
        SELECT l.location_id FROM location l
         WHERE l.organization_id = $1
           AND (EXISTS (SELECT 1 FROM granted g WHERE g.kind = 'location' AND g.id = l.location_id)
             OR (l.physical_parent_type = 'estate'   AND l.physical_parent_id IN (SELECT estate_id FROM covered_estate))
             OR (l.physical_parent_type = 'phase'    AND l.physical_parent_id IN (SELECT phase_id FROM covered_phase))
             OR (l.physical_parent_type = 'building' AND l.physical_parent_id IN (SELECT building_id FROM covered_building))
             OR (l.physical_parent_type = 'floor'    AND l.physical_parent_id IN (SELECT floor_id FROM covered_floor)))),
      loc AS (
        WITH RECURSIVE closure AS (
          SELECT location_id FROM loc_seed
          UNION
          SELECT child.location_id FROM location child JOIN closure ON child.parent_location_id = closure.location_id)
        SELECT location_id FROM closure)
      SELECT 'estate' AS kind, estate_id AS id FROM covered_estate
      UNION ALL SELECT 'phase', phase_id FROM covered_phase
      UNION ALL SELECT 'building', building_id FROM covered_building
      UNION ALL SELECT 'floor', floor_id FROM covered_floor
      UNION ALL SELECT 'unit', unit_id FROM covered_unit
      UNION ALL SELECT 'location', location_id FROM loc`

// Expand expands grants on hierarchy nodes to every node they cover.
func (p *Property) Expand(ctx context.Context, orgID string, grants []ScopeNode) (ExpandedScope, error) {
	out := EmptyScope()
	if len(grants) == 0 {
		return out, nil
	}
	kinds, ids := make([]string, len(grants)), make([]string, len(grants))
	for i, g := range grants {
		kinds[i], ids[i] = g.Kind, g.ID
	}
	rows, err := p.DB.Query(ctx, expandSQL, orgID, kinds, ids)
	if err != nil {
		return out, err
	}
	by := func(kind string) []string {
		res := []string{}
		for _, r := range rows {
			if r.Str("kind") == kind {
				res = append(res, r.Str("id"))
			}
		}
		return res
	}
	pick := func(kind string) []string {
		res := []string{}
		for _, g := range grants {
			if g.Kind == kind {
				res = append(res, g.ID)
			}
		}
		return res
	}
	return ExpandedScope{pick("organization"), pick("portfolio"), by("estate"), by("phase"), by("building"),
		by("floor"), by("unit"), by("location")}, nil
}

var _ = platform.ISO
