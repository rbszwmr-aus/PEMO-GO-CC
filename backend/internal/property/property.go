// Package property is Property Core: the organisation -> estate -> building
// -> floor -> unit hierarchy, locations with serving scopes, building-service
// availability and estate contacts (ADR-003).
package property

import (
	"context"
	"fmt"
	"time"

	"pemo/internal/platform"
)

// Bilingual is English + Traditional Chinese text.
type Bilingual = platform.LocalizedText

// UnitRecord is one unit with its place in the hierarchy.
type UnitRecord struct {
	UnitID         string    `json:"unitId"`
	UnitClass      string    `json:"unitClass"`
	OrganizationID string    `json:"organizationId"`
	EstateID       string    `json:"estateId"`
	PhaseID        *string   `json:"phaseId"`
	PortfolioID    *string   `json:"portfolioId"`
	BuildingID     string    `json:"buildingId"`
	FloorID        string    `json:"floorId"`
	EstateName     Bilingual `json:"estateName"`
	BlockName      Bilingual `json:"blockName"`
	FloorLabel     string    `json:"floorLabel"`
	FlatLabel      string    `json:"flatLabel"`
}

// ServingScopeNode is one node a location serves.
type ServingScopeNode struct {
	NodeType string `json:"nodeType"`
	NodeID   string `json:"nodeId"`
}

// LocationRecord is a non-unit location (ADR-003 classes).
type LocationRecord struct {
	LocationID         string             `json:"locationId"`
	OrganizationID     string             `json:"organizationId"`
	EstateID           string             `json:"estateId"`
	LocationClass      string             `json:"locationClass"`
	PhysicalParentType string             `json:"physicalParentType"`
	PhysicalParentID   string             `json:"physicalParentId"`
	ParentLocationID   *string            `json:"parentLocationId"`
	Name               Bilingual          `json:"name"`
	ExternalRef        *string            `json:"externalRef"`
	ServingScope       []ServingScopeNode `json:"servingScope"`
}

// BuildingServiceAvailability: a stale reading is reported as unknown.
type BuildingServiceAvailability struct {
	LocationID    string    `json:"locationId"`
	Name          Bilingual `json:"name"`
	State         string    `json:"state"`
	StoredState   string    `json:"storedState"`
	Stale         bool      `json:"stale"`
	LastUpdatedAt string    `json:"lastUpdatedAt"`
	Source        string    `json:"source"`
}

// EstateContact is one published estate contact.
type EstateContact struct {
	ContactID           string     `json:"contactId"`
	EstateID            string     `json:"estateId"`
	ContactKind         string     `json:"contactKind"`
	Name                Bilingual  `json:"name"`
	Telephone           *string    `json:"telephone"`
	Hours               *Bilingual `json:"hours"`
	Instructions        *Bilingual `json:"instructions"`
	OpensAt             *string    `json:"opensAt"`
	ClosesAt            *string    `json:"closesAt"`
	TypicalReplyMinutes *int64     `json:"typicalReplyMinutes"`
}

// ScopeNode is a node of the access hierarchy (grants are made on these).
type ScopeNode struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
}

// CreateLocationInput creates a location; servingScope is mandatory.
type CreateLocationInput struct {
	LocationID, OrganizationID, EstateID string
	LocationClass                        string
	PhysicalParentType, PhysicalParentID string
	ParentLocationID                     *string
	Name                                 Bilingual
	ExternalRef                          *string
	ServingScope                         []ServingScopeNode
}

// Property is the module facade over its own pool.
type Property struct{ DB platform.DB }

// New binds Property Core to its pool.
func New(db platform.DB) *Property { return &Property{DB: db} }

const unitSelect = `
  SELECT u.unit_id, u.unit_class, e.organization_id, e.estate_id, b.phase_id, e.portfolio_id,
         b.building_id, f.floor_id,
         e.name_en AS estate_name_en, e.name_zh_hant AS estate_name_zh,
         b.name_en AS block_name_en, b.name_zh_hant AS block_name_zh,
         f.label AS floor_label, u.label AS flat_label
    FROM unit u
    JOIN floor f    ON f.floor_id = u.floor_id
    JOIN building b ON b.building_id = f.building_id
    JOIN estate e   ON e.estate_id = b.estate_id
`

func toUnit(r platform.Row) UnitRecord {
	return UnitRecord{
		UnitID: r.Str("unit_id"), UnitClass: r.Str("unit_class"), OrganizationID: r.Str("organization_id"),
		EstateID: r.Str("estate_id"), PhaseID: r.StrPtr("phase_id"), PortfolioID: r.StrPtr("portfolio_id"),
		BuildingID: r.Str("building_id"), FloorID: r.Str("floor_id"),
		EstateName: Bilingual{En: r.Str("estate_name_en"), ZhHant: r.Str("estate_name_zh")},
		BlockName:  Bilingual{En: r.Str("block_name_en"), ZhHant: r.Str("block_name_zh")},
		FloorLabel: r.Str("floor_label"), FlatLabel: r.Str("flat_label"),
	}
}

// FindUnit reads one unit regardless of organisation (internal use).
func (p *Property) FindUnit(ctx context.Context, unitID string) (*UnitRecord, error) {
	r, err := p.DB.QueryOne(ctx, unitSelect+" WHERE u.unit_id = $1", unitID)
	if err != nil || r == nil {
		return nil, err
	}
	u := toUnit(r)
	return &u, nil
}

// FindUnits reads several units.
func (p *Property) FindUnits(ctx context.Context, ids []string) ([]UnitRecord, error) {
	if len(ids) == 0 {
		return []UnitRecord{}, nil
	}
	rows, err := p.DB.Query(ctx, unitSelect+" WHERE u.unit_id = ANY($1::text[])", ids)
	if err != nil {
		return nil, err
	}
	out := make([]UnitRecord, 0, len(rows))
	for _, r := range rows {
		out = append(out, toUnit(r))
	}
	return out, nil
}

// GetUnit returns the unit only inside the caller's organisation.
func (p *Property) GetUnit(ctx context.Context, orgID, unitID string) (*UnitRecord, error) {
	u, err := p.FindUnit(ctx, unitID)
	if err != nil || u == nil || u.OrganizationID != orgID {
		return nil, err
	}
	return u, nil
}

// GetResidentialUnit is GetUnit restricted to residential units.
func (p *Property) GetResidentialUnit(ctx context.Context, orgID, unitID string) (*UnitRecord, error) {
	u, err := p.GetUnit(ctx, orgID, unitID)
	if err != nil || u == nil || u.UnitClass != "residential" {
		return nil, err
	}
	return u, nil
}

// GetResidentialUnits filters several units to the organisation and class.
func (p *Property) GetResidentialUnits(ctx context.Context, orgID string, ids []string) ([]UnitRecord, error) {
	us, err := p.FindUnits(ctx, ids)
	if err != nil {
		return nil, err
	}
	out := make([]UnitRecord, 0, len(us))
	for _, u := range us {
		if u.OrganizationID == orgID && u.UnitClass == "residential" {
			out = append(out, u)
		}
	}
	return out, nil
}

const locationCols = `location_id, organization_id, estate_id, location_class, physical_parent_type,
            physical_parent_id, parent_location_id, name_en, name_zh_hant, external_ref`

func toLocation(r platform.Row, scope []ServingScopeNode) LocationRecord {
	if scope == nil {
		scope = []ServingScopeNode{}
	}
	return LocationRecord{
		LocationID: r.Str("location_id"), OrganizationID: r.Str("organization_id"), EstateID: r.Str("estate_id"),
		LocationClass: r.Str("location_class"), PhysicalParentType: r.Str("physical_parent_type"),
		PhysicalParentID: r.Str("physical_parent_id"), ParentLocationID: r.StrPtr("parent_location_id"),
		Name: Bilingual{En: r.Str("name_en"), ZhHant: r.Str("name_zh_hant")}, ExternalRef: r.StrPtr("external_ref"),
		ServingScope: scope,
	}
}

// FindLocations reads locations with their serving scopes.
func (p *Property) FindLocations(ctx context.Context, ids []string) ([]LocationRecord, error) {
	if len(ids) == 0 {
		return []LocationRecord{}, nil
	}
	rows, err := p.DB.Query(ctx, `SELECT `+locationCols+` FROM location WHERE location_id = ANY($1) ORDER BY location_id`, ids)
	if err != nil {
		return nil, err
	}
	scope, err := p.DB.Query(ctx, `SELECT location_id, node_type, node_id FROM location_serving_scope
      WHERE location_id = ANY($1) ORDER BY location_id, node_type, node_id`, ids)
	if err != nil {
		return nil, err
	}
	by := map[string][]ServingScopeNode{}
	for _, s := range scope {
		id := s.Str("location_id")
		by[id] = append(by[id], ServingScopeNode{s.Str("node_type"), s.Str("node_id")})
	}
	out := make([]LocationRecord, 0, len(rows))
	for _, r := range rows {
		out = append(out, toLocation(r, by[r.Str("location_id")]))
	}
	return out, nil
}

// FindLocation reads one location with its serving scope.
func (p *Property) FindLocation(ctx context.Context, id string) (*LocationRecord, error) {
	r, err := p.DB.QueryOne(ctx, `SELECT `+locationCols+` FROM location WHERE location_id = $1`, id)
	if err != nil || r == nil {
		return nil, err
	}
	scope, err := p.DB.Query(ctx, `SELECT node_type, node_id FROM location_serving_scope WHERE location_id = $1 ORDER BY node_type, node_id`, id)
	if err != nil {
		return nil, err
	}
	nodes := []ServingScopeNode{}
	for _, s := range scope {
		nodes = append(nodes, ServingScopeNode{s.Str("node_type"), s.Str("node_id")})
	}
	l := toLocation(r, nodes)
	return &l, nil
}

// ServingScopeRequiredError: serving scope must never default to the parent.
type ServingScopeRequiredError struct{ LocationID string }

func (e *ServingScopeRequiredError) Error() string {
	return fmt.Sprintf("Location %s was created without a serving scope. serving_scope is not optional and must not default to the physical parent (ADR-003).", e.LocationID)
}

// CreateLocation inserts a location and its serving scope in one transaction.
// The scope rows go in one statement (review P1: no per-row round trips).
func (p *Property) CreateLocation(ctx context.Context, in CreateLocationInput) error {
	if len(in.ServingScope) == 0 {
		return &ServingScopeRequiredError{in.LocationID}
	}
	return p.DB.Tx(ctx, func(tx platform.DB) error {
		if err := tx.Exec(ctx, `INSERT INTO location (location_id, organization_id, estate_id, location_class,
                             physical_parent_type, physical_parent_id, parent_location_id,
                             name_en, name_zh_hant, external_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
			in.LocationID, in.OrganizationID, in.EstateID, in.LocationClass, in.PhysicalParentType,
			in.PhysicalParentID, in.ParentLocationID, in.Name.En, in.Name.ZhHant, in.ExternalRef); err != nil {
			return err
		}
		types, ids := make([]string, 0, len(in.ServingScope)), make([]string, 0, len(in.ServingScope))
		for _, n := range in.ServingScope {
			types, ids = append(types, n.NodeType), append(ids, n.NodeID)
		}
		return tx.Exec(ctx, `INSERT INTO location_serving_scope (location_id, node_type, node_id)
       SELECT $1, t, i FROM unnest($2::text[], $3::text[]) AS x(t, i)`, in.LocationID, types, ids)
	})
}

const servedUnitsWhere = `
       FROM location_serving_scope s
       CROSS JOIN unit u
       JOIN floor    f ON f.floor_id = u.floor_id
       JOIN building b ON b.building_id = f.building_id
       JOIN estate   e ON e.estate_id = b.estate_id
      WHERE %s
        AND u.unit_class = 'residential'
        AND (
              (s.node_type = 'estate'   AND e.estate_id   = s.node_id)
           OR (s.node_type = 'phase'    AND b.phase_id    = s.node_id)
           OR (s.node_type = 'building' AND b.building_id = s.node_id)
           OR (s.node_type = 'floor'    AND f.floor_id    = s.node_id)
           OR (s.node_type = 'unit'     AND u.unit_id     = s.node_id)
        )`

func (p *Property) findUnitsInServingScopes(ctx context.Context, ids []string) (map[string][]string, error) {
	out := map[string][]string{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := p.DB.Query(ctx, "SELECT DISTINCT s.location_id, u.unit_id"+
		fmt.Sprintf(servedUnitsWhere, "s.location_id = ANY($1)")+" ORDER BY s.location_id, u.unit_id", ids)
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.Str("location_id")] = append(out[r.Str("location_id")], r.Str("unit_id"))
	}
	return out, nil
}

func (p *Property) findUnitsInServingScope(ctx context.Context, id string) ([]string, error) {
	rows, err := p.DB.Query(ctx, "SELECT DISTINCT u.unit_id"+fmt.Sprintf(servedUnitsWhere, "s.location_id = $1")+" ORDER BY u.unit_id", id)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(rows))
	for _, r := range rows {
		out = append(out, r.Str("unit_id"))
	}
	return out, nil
}

// GetLocation returns the location only inside the caller's organisation.
func (p *Property) GetLocation(ctx context.Context, orgID, id string) (*LocationRecord, error) {
	l, err := p.FindLocation(ctx, id)
	if err != nil || l == nil || l.OrganizationID != orgID {
		return nil, err
	}
	return l, nil
}

// GetLocations filters several locations to the organisation.
func (p *Property) GetLocations(ctx context.Context, orgID string, ids []string) ([]LocationRecord, error) {
	ls, err := p.FindLocations(ctx, ids)
	if err != nil {
		return nil, err
	}
	out := make([]LocationRecord, 0, len(ls))
	for _, l := range ls {
		if l.OrganizationID == orgID {
			out = append(out, l)
		}
	}
	return out, nil
}

// ResolveServedUnitsMany resolves each location's served residential units.
// A public area serves nobody.
func (p *Property) ResolveServedUnitsMany(ctx context.Context, orgID string, ids []string) (map[string][]string, error) {
	unique := uniqueStrings(ids)
	found, err := p.GetLocations(ctx, orgID, unique)
	if err != nil {
		return nil, err
	}
	var usable []string
	for _, l := range found {
		if l.LocationClass != "public_area" {
			usable = append(usable, l.LocationID)
		}
	}
	units, err := p.findUnitsInServingScopes(ctx, usable)
	if err != nil {
		return nil, err
	}
	out := map[string][]string{}
	for _, id := range unique {
		if u, ok := units[id]; ok {
			out[id] = u
		} else {
			out[id] = []string{}
		}
	}
	return out, nil
}

// ResolveServedUnits resolves one location's served residential units.
func (p *Property) ResolveServedUnits(ctx context.Context, orgID, id string) ([]string, error) {
	l, err := p.GetLocation(ctx, orgID, id)
	if err != nil {
		return nil, err
	}
	if l == nil || l.LocationClass == "public_area" {
		return []string{}, nil
	}
	return p.findUnitsInServingScope(ctx, id)
}

// ResolveServingScopeNodes returns "kind:id" keys of a location's serving scope.
func (p *Property) ResolveServingScopeNodes(ctx context.Context, orgID, id string) ([]string, error) {
	rows, err := p.DB.Query(ctx, `SELECT s.node_type, s.node_id
         FROM location_serving_scope s JOIN location l ON l.location_id = s.location_id
        WHERE s.location_id = $1 AND l.organization_id = $2 ORDER BY 1, 2`, id, orgID)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(rows))
	for _, r := range rows {
		out = append(out, r.Str("node_type")+":"+r.Str("node_id"))
	}
	return out, nil
}

// LocationsServingNodes returns locations whose serving scope reaches a key.
func (p *Property) LocationsServingNodes(ctx context.Context, orgID string, keys []string) ([]string, error) {
	if len(keys) == 0 {
		return []string{}, nil
	}
	rows, err := p.DB.Query(ctx, `SELECT DISTINCT s.location_id
         FROM location_serving_scope s JOIN location l ON l.location_id = s.location_id
        WHERE l.organization_id = $1 AND (s.node_type || ':' || s.node_id) = ANY($2) ORDER BY 1`, orgID, keys)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(rows))
	for _, r := range rows {
		out = append(out, r.Str("location_id"))
	}
	return out, nil
}

// GetAvailability reads a building service's availability; past its
// freshness window the state is reported as unknown.
func (p *Property) GetAvailability(ctx context.Context, locationID string, now time.Time) (*BuildingServiceAvailability, error) {
	r, err := p.DB.QueryOne(ctx, `SELECT a.location_id, l.name_en, l.name_zh_hant, a.state, a.source,
            a.last_updated_at, a.freshness_window_seconds
       FROM building_service_availability a JOIN location l ON l.location_id = a.location_id
      WHERE a.location_id = $1`, locationID)
	if err != nil || r == nil {
		return nil, err
	}
	age := now.Sub(r.Time("last_updated_at")).Seconds()
	stale := age > r.Float("freshness_window_seconds")
	state := r.Str("state")
	if stale {
		state = "unknown"
	}
	return &BuildingServiceAvailability{LocationID: r.Str("location_id"),
		Name: Bilingual{En: r.Str("name_en"), ZhHant: r.Str("name_zh_hant")}, State: state,
		StoredState: r.Str("state"), Stale: stale, LastUpdatedAt: platform.ISO(r.Time("last_updated_at")),
		Source: r.Str("source")}, nil
}

// ListContacts returns an estate's contacts in display order.
func (p *Property) ListContacts(ctx context.Context, estateID string) ([]EstateContact, error) {
	rows, err := p.DB.Query(ctx, `SELECT contact_id, estate_id, contact_kind, name_en, name_zh_hant, telephone,
            hours_en, hours_zh_hant, instructions_en, instructions_zh_hant,
            opens_at::text AS opens_at, closes_at::text AS closes_at, typical_reply_minutes
       FROM estate_contact WHERE estate_id = $1 ORDER BY sort_order, contact_id`, estateID)
	if err != nil {
		return nil, err
	}
	out := make([]EstateContact, 0, len(rows))
	for _, r := range rows {
		c := EstateContact{ContactID: r.Str("contact_id"), EstateID: r.Str("estate_id"), ContactKind: r.Str("contact_kind"),
			Name: Bilingual{En: r.Str("name_en"), ZhHant: r.Str("name_zh_hant")}, Telephone: r.StrPtr("telephone"),
			OpensAt: r.StrPtr("opens_at"), ClosesAt: r.StrPtr("closes_at")}
		if r["hours_en"] != nil && r["hours_zh_hant"] != nil {
			c.Hours = &Bilingual{En: r.Str("hours_en"), ZhHant: r.Str("hours_zh_hant")}
		}
		if r["instructions_en"] != nil && r["instructions_zh_hant"] != nil {
			c.Instructions = &Bilingual{En: r.Str("instructions_en"), ZhHant: r.Str("instructions_zh_hant")}
		}
		if r["typical_reply_minutes"] != nil {
			n := r.Int("typical_reply_minutes")
			c.TypicalReplyMinutes = &n
		}
		out = append(out, c)
	}
	return out, nil
}

// GetManagementOffice returns the estate's management office contact.
func (p *Property) GetManagementOffice(ctx context.Context, estateID string) (*EstateContact, error) {
	cs, err := p.ListContacts(ctx, estateID)
	if err != nil {
		return nil, err
	}
	for i := range cs {
		if cs[i].ContactKind == "management_office" {
			return &cs[i], nil
		}
	}
	return nil, nil
}

// ScopedEstate is an estate the caller may write contacts to.
type ScopedEstate struct{ EstateID, OrganizationID string }

// FindEstateInScope returns the estate only if it is in allowed.
func (p *Property) FindEstateInScope(ctx context.Context, estateID string, allowed []string) (*ScopedEstate, error) {
	if len(allowed) == 0 {
		return nil, nil
	}
	r, err := p.DB.QueryOne(ctx, `SELECT estate_id, organization_id FROM estate WHERE estate_id = $1 AND estate_id = ANY($2::text[])`, estateID, allowed)
	if err != nil || r == nil {
		return nil, err
	}
	return &ScopedEstate{r.Str("estate_id"), r.Str("organization_id")}, nil
}

// CountContactsOfKind counts an estate's contacts of one kind.
func (p *Property) CountContactsOfKind(ctx context.Context, estateID, kind string) (int64, error) {
	r, err := p.DB.QueryOne(ctx, `SELECT count(*) AS n FROM estate_contact WHERE estate_id = $1 AND contact_kind = $2`, estateID, kind)
	if err != nil {
		return -1, err
	}
	if r == nil {
		return -1, nil
	}
	return r.Int("n"), nil
}

// AddEstateContactInput is one new contact.
type AddEstateContactInput struct {
	ContactID, EstateID, ContactKind, NameEn, NameZhHant string
	Telephone, HoursEn, HoursZhHant                      *string
	SortOrder                                            int
}

// AddContact inserts a contact on the caller's transaction.
func AddContact(ctx context.Context, tx platform.DB, in AddEstateContactInput) error {
	return tx.Exec(ctx, `INSERT INTO estate_contact
       (contact_id, estate_id, contact_kind, name_en, name_zh_hant, telephone, hours_en, hours_zh_hant, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		in.ContactID, in.EstateID, in.ContactKind, in.NameEn, in.NameZhHant, in.Telephone, in.HoursEn, in.HoursZhHant, in.SortOrder)
}

func uniqueStrings(in []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(in))
	for _, s := range in {
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	return out
}
