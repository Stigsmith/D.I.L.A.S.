package datalib

// D.I.L.A.S. addition, not upstream. Resolves one component of one entity
// the way the game shows it: the base data, the entity's own delta, then
// the delta of every default attachment (magazine, ammo type and so on).

import (
	"encoding/binary"

	"github.com/xypwn/filediver/stingray"
)

type DilasAttachment struct {
	Slot      string
	DebugName string
	AddPath   stingray.Hash
}

func DilasDefaultAttachments(resource stingray.Hash) ([]DilasAttachment, error) {
	data, err := getComponentDataForHash(Sum("WeaponCustomizationComponentData"), resource)
	if err != nil {
		return nil, err
	}
	var base WeaponCustomizationComponent
	if _, err := binary.Decode(data, binary.LittleEndian, &base); err != nil {
		return nil, err
	}
	settings, err := ParseWeaponCustomizationSettings(func(id stingray.FileID, typ stingray.DataType) ([]byte, bool, error) {
		return nil, false, nil
	}, map[uint32]string{})
	if err != nil {
		return nil, err
	}
	items := map[stingray.ThinHash]WeaponCustomizableItem{}
	for _, s := range settings {
		for _, it := range s.Items {
			items[it.ID] = it
		}
	}
	out := []DilasAttachment{}
	for _, d := range base.DefaultCustomizations {
		it, ok := items[d.Customization]
		if !ok {
			continue
		}
		out = append(out, DilasAttachment{Slot: d.Slot.String(), DebugName: it.DebugName, AddPath: it.AddPath})
	}
	return out, nil
}

func DilasResolve(resource stingray.Hash, componentName string, attachments []DilasAttachment) (Component, bool, error) {
	ct := Sum(componentName)
	data, err := getComponentDataForHash(ct, resource)
	if err != nil || data == nil {
		return nil, false, nil
	}
	deltas, err := ParseEntityDeltas()
	if err != nil {
		return nil, false, err
	}
	if d, ok := deltas[resource]; ok {
		if data, err = PatchComponent(ct, data, d); err != nil {
			return nil, false, err
		}
	}
	for _, a := range attachments {
		if d, ok := deltas[a.AddPath]; ok {
			if data, err = PatchComponent(ct, data, d); err != nil {
				return nil, false, err
			}
		}
	}
	c, err := parseComponent(ct, data)
	if err != nil {
		return nil, false, err
	}
	return c, true, nil
}
