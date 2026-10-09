// D.I.L.A.S. dump: writes filediver's bundled, already decoded settings
// tables to JSON. It never opens the game install: every table here is
// one filediver ships inside its own source, and names come from its
// published hash list only.
package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"reflect"
	"strings"

	datalib "github.com/xypwn/filediver/datalibrary"
	"github.com/xypwn/filediver/hashes"
	"github.com/xypwn/filediver/stingray"
)

var (
	hashNames = map[stingray.Hash]string{}
	thinNames = map[stingray.ThinHash]string{}
	outDir    string
)

func lookupHash(h stingray.Hash) string {
	if n, ok := hashNames[h]; ok {
		return n
	}
	return h.String()
}
func lookupThin(h stingray.ThinHash) string {
	if n, ok := thinNames[h]; ok {
		return n
	}
	return h.String()
}
func lookupString(id uint32) string { return fmt.Sprintf("string:%08x", id) }

func write(name string, v any, err error) {
	if err != nil {
		fmt.Fprintf(os.Stderr, "FAIL %s: %v\n", name, err)
		return
	}
	b, err := json.MarshalIndent(clean(reflect.ValueOf(v)), "", " ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "FAIL %s: %v\n", name, err)
		return
	}
	os.WriteFile(filepath.Join(outDir, name+".json"), b, 0644)
	fmt.Fprintf(os.Stderr, "ok   %s %d bytes\n", name, len(b))
}

type simple interface {
	ToSimple(datalib.HashLookup, datalib.ThinHashLookup, datalib.StringsLookup) any
}

func components[T simple](name string, parse func() (map[stingray.Hash]T, error)) {
	m, err := parse()
	out := map[string]any{}
	for k, v := range m {
		out[lookupHash(k)] = v.ToSimple(lookupHash, lookupThin, lookupString)
	}
	write(name, out, err)
}

func main() {
	outDir = os.Args[1]
	os.MkdirAll(outDir, 0755)
	for _, n := range hashes.ParseHashes(hashes.Hashes) {
		hashNames[stingray.Sum(n)] = n
	}
	for _, n := range hashes.ParseHashes(hashes.ThinHashes) {
		thinNames[stingray.Sum(n).Thin()] = n
	}

	v1, e1 := datalib.LoadDamageSettings(lookupHash, lookupThin, lookupString)
	write("damage", v1, e1)
	v2, e2 := datalib.LoadProjectileSettings(lookupHash, lookupThin, lookupString)
	write("projectile", v2, e2)
	v3, e3 := datalib.LoadExplosionSettings(lookupHash, lookupThin, lookupString)
	write("explosion", v3, e3)
	v4, e4 := datalib.LoadBeamSettings(lookupHash, lookupThin, lookupString)
	write("beam", v4, e4)
	v5, e5 := datalib.LoadArcSettings(lookupHash, lookupThin, lookupString)
	write("arc", v5, e5)
	passives, e6 := datalib.LoadPassiveBonusDefinitions(lookupHash, lookupThin, lookupString)
	write("passive-bonus", passives, e6)
	if e6 == nil {
		v7, e7 := datalib.LoadArmorSetArray(map[uint32]string{}, passives)
		write("armor-set", v7, e7)
	}
	v8, e8 := datalib.LoadEnvironmentSettings()
	write("environment", v8, e8)
	v9, e9 := datalib.LoadPlanetData(lookupHash, lookupThin, lookupString)
	write("planet-data", v9, e9)

	// No install: the resource lookup always answers "not here", which
	// these parsers accept, and the language map is empty.
	noGame := func(id stingray.FileID, typ stingray.DataType) ([]byte, bool, error) { return nil, false, nil }
	if wc, err := datalib.ParseWeaponCustomizationSettings(noGame, map[uint32]string{}); err != nil {
		write("weapon-customization", nil, err)
	} else {
		out := []any{}
		for _, c := range wc {
			out = append(out, c.ToSimple(lookupHash, lookupThin))
		}
		write("weapon-customization", out, nil)
	}
	if wcc, err := datalib.ParseWeaponCustomizationComponents(noGame, map[uint32]string{}); err != nil {
		write("c-weapon-customization", nil, err)
	} else {
		out := map[string]any{}
		for k, c := range wcc {
			out[lookupHash(k)] = c.ToSimple(lookupHash, lookupThin, lookupString)
		}
		write("c-weapon-customization", out, nil)
	}

	resolved()

	components("c-projectile-weapon", datalib.ParseProjectileWeaponComponents)
	components("c-beam-weapon", datalib.ParseBeamWeaponComponents)
	components("c-arc-weapon", datalib.ParseArcWeaponComponents)
	components("c-weapon-data", datalib.ParseWeaponDataComponents)
	components("c-weapon-magazine", datalib.ParseWeaponMagazineComponents)
	components("c-weapon-reload", datalib.ParseWeaponReloadComponents)
	components("c-weapon-heat", datalib.ParseWeaponHeatComponents)
	components("c-weapon-charge", datalib.ParseWeaponChargeComponents)
	components("c-weapon-rounds", datalib.ParseWeaponRoundsComponents)
	components("c-weapon-windup", datalib.ParseWeaponWindUpComponents)
	components("c-melee-attack", datalib.ParseMeleeAttackComponents)
	components("c-equipment", datalib.ParseEquipmentComponents)
	components("c-explosive", datalib.ParseExplosiveComponents)
	components("c-health", datalib.ParseHealthComponents)
	components("c-encyclopedia", datalib.ParseEncyclopediaEntryComponents)
	components("c-faction", datalib.ParseFactionComponents)
	components("c-hellpod", datalib.ParseHellpodComponents)
	components("c-seeking-missile", datalib.ParseSeekingMissileComponents)
	components("c-wieldable", datalib.ParseWieldableComponents)
	components("c-tag", datalib.ParseTagComponents)
}

// clean walks a value into plain maps and slices, honouring json tags,
// with NaN and infinities as null, which encoding/json refuses outright.
func clean(v reflect.Value) any {
	if !v.IsValid() {
		return nil
	}
	if v.CanInterface() {
		if m, ok := v.Interface().(json.Marshaler); ok && v.Kind() != reflect.Struct {
			b, err := m.MarshalJSON()
			if err == nil {
				var out any
				json.Unmarshal(b, &out)
				return out
			}
		}
		isInt := v.Kind() >= reflect.Int && v.Kind() <= reflect.Uint64
		if s, ok := v.Interface().(fmt.Stringer); ok && isInt {
			return s.String()
		}
	}
	switch v.Kind() {
	case reflect.Ptr, reflect.Interface:
		if v.IsNil() {
			return nil
		}
		return clean(v.Elem())
	case reflect.Float32, reflect.Float64:
		f := v.Float()
		if math.IsNaN(f) || math.IsInf(f, 0) {
			return nil
		}
		return f
	case reflect.Struct:
		out := map[string]any{}
		t := v.Type()
		for i := 0; i < t.NumField(); i++ {
			f := t.Field(i)
			if !f.IsExported() {
				continue
			}
			name := f.Name
			if tag := f.Tag.Get("json"); tag != "" {
				part := strings.Split(tag, ",")[0]
				if part == "-" {
					continue
				}
				if part != "" {
					name = part
				}
			}
			out[name] = clean(v.Field(i))
		}
		return out
	case reflect.Slice, reflect.Array:
		if v.Kind() == reflect.Slice && v.IsNil() {
			return nil
		}
		out := make([]any, v.Len())
		for i := range out {
			out[i] = clean(v.Index(i))
		}
		return out
	case reflect.Map:
		out := map[string]any{}
		for _, k := range v.MapKeys() {
			out[fmt.Sprint(clean(k))] = clean(v.MapIndex(k))
		}
		return out
	}
	if v.CanInterface() {
		return v.Interface()
	}
	return nil
}

// resolved writes every held or called-in weapon with its default
// attachments applied, the figures the armoury shows.
func resolved() {
	keys := map[stingray.Hash]bool{}
	add := func(m map[stingray.Hash]bool) {
		for k := range m {
			keys[k] = true
		}
	}
	collect := func(ks []stingray.Hash) map[stingray.Hash]bool {
		m := map[stingray.Hash]bool{}
		for _, k := range ks {
			m[k] = true
		}
		return m
	}
	if m, err := datalib.ParseWeaponMagazineComponents(); err == nil {
		ks := []stingray.Hash{}
		for k := range m {
			ks = append(ks, k)
		}
		add(collect(ks))
	}
	if m, err := datalib.ParseProjectileWeaponComponents(); err == nil {
		ks := []stingray.Hash{}
		for k := range m {
			ks = append(ks, k)
		}
		add(collect(ks))
	}
	if m, err := datalib.ParseWeaponDataComponents(); err == nil {
		ks := []stingray.Hash{}
		for k := range m {
			ks = append(ks, k)
		}
		add(collect(ks))
	}
	if m, err := datalib.ParseMeleeAttackComponents(); err == nil {
		ks := []stingray.Hash{}
		for k := range m {
			ks = append(ks, k)
		}
		add(collect(ks))
	}
	if m, err := datalib.ParseArcWeaponComponents(); err == nil {
		ks := []stingray.Hash{}
		for k := range m {
			ks = append(ks, k)
		}
		add(collect(ks))
	}
	names := []string{
		"WeaponDataComponentData", "WeaponMagazineComponentData", "WeaponReloadComponentData",
		"ProjectileWeaponComponentData", "WeaponHeatComponentData", "WeaponChargeComponentData",
		"WeaponRoundsComponentData", "WeaponWindUpComponentData", "ArcWeaponComponentData",
		"MeleeAttackComponentData", "EquipmentComponentData", "EncyclopediaEntryComponentData",
	}
	out := map[string]any{}
	errs := 0
	for k := range keys {
		atts, _ := datalib.DilasDefaultAttachments(k)
		simpleAtts := []any{}
		for _, a := range atts {
			simpleAtts = append(simpleAtts, map[string]string{"slot": a.Slot, "name": a.DebugName, "path": lookupHash(a.AddPath)})
		}
		comps := map[string]any{}
		for _, n := range names {
			c, ok, err := datalib.DilasResolve(k, n, atts)
			if err != nil {
				errs++
				comps[n] = map[string]string{"error": err.Error()}
				continue
			}
			if ok {
				comps[n] = c.ToSimple(lookupHash, lookupThin, lookupString)
			}
		}
		out[lookupHash(k)] = map[string]any{"attachments": simpleAtts, "components": comps}
	}
	fmt.Fprintf(os.Stderr, "resolved %d entities, %d component errors\n", len(keys), errs)
	write("resolved", out, nil)
}
