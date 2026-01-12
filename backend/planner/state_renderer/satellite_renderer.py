# backend/planner/state_renderer/satellite_renderer.py

from typing import Dict, List, Optional, Set, Tuple
from .base_renderer import BaseStateRenderer, RenderedState, VisualObject, VisualRelation


class SatelliteRenderer(BaseStateRenderer):
    """
    Renderer for the Satellite planning domain.
    Converts planning states into visual objects and relations.

    Expected domain predicates (based on your PDDL):
    - (pointing ?s - satellite ?d - direction)
    - (onboard ?i - instrument ?s - satellite)
    - (supports ?i - instrument ?t - target)
    - (calibrated ?i - instrument)
    - (calibration-target ?i - instrument ?t - target)
    - (have-image ?t - target)
    - (image-taken ?i - instrument ?t - target)
    - (power-avail ?s - satellite)
    - (storage-avail ?s - satellite)
    - (visible ?s - satellite ?g - groundstation)
    """

    def __init__(self):
        super().__init__("satellite")
        self.colors = {
            "satellite": "#4ECDC4",      # Teal
            "instrument": "#FFE66D",     # Yellow
            "target": "#FF6B6B",         # Red
            "direction": "#95E1D3",      # Light green
            "groundstation": "#A9A9A9",  # Gray
            "path": "rgba(0,0,0,0.20)",  # For links
        }

    def render(
        self,
        state: Set,
        objects: Dict[str, str],
        metadata: Optional[Dict] = None
    ) -> RenderedState:

        visual_objects: List[VisualObject] = []
        visual_relations: List[VisualRelation] = []

        # ------------------------------------------------------------
        # 1) Collect objects by type (same style as rovers)
        # ------------------------------------------------------------
        satellites = [n for n, t in objects.items() if t == "satellite"]
        instruments = [n for n, t in objects.items() if t == "instrument"]
        targets = [n for n, t in objects.items() if t == "target"]
        directions = [n for n, t in objects.items() if t == "direction"]
        groundstations = [n for n, t in objects.items() if t == "groundstation"]

        # Defensive: sometimes parser mistakenly includes type names as objects
        bad = {"satellite", "instrument", "target", "direction", "groundstation"}
        satellites = [x for x in satellites if x not in bad]
        instruments = [x for x in instruments if x not in bad]
        targets = [x for x in targets if x not in bad]
        directions = [x for x in directions if x not in bad]
        groundstations = [x for x in groundstations if x not in bad]

        # Helper: sort by numeric suffix if exists (like rovers)
        def num_suffix(x: str) -> int:
            import re
            m = re.search(r"(\d+)$", x)
            return int(m.group(1)) if m else 9999

        satellites = sorted(satellites, key=lambda x: (num_suffix(x), x))
        instruments = sorted(instruments, key=lambda x: (num_suffix(x), x))
        targets = sorted(targets, key=lambda x: (num_suffix(x), x))
        directions = sorted(directions, key=lambda x: (num_suffix(x), x))
        groundstations = sorted(groundstations, key=lambda x: (num_suffix(x), x))

        # ------------------------------------------------------------
        # 2) Parse predicates into useful maps/sets
        # ------------------------------------------------------------
        pointing: Dict[str, str] = {}                 # sat -> dir
        onboard: Dict[str, str] = {}                  # inst -> sat
        calibrated: Set[str] = set()                  # inst
        supports: Set[Tuple[str, str]] = set()        # (inst, target)
        calibration_target: Set[Tuple[str, str]] = set()  # (inst, target)
        image_taken: Set[Tuple[str, str]] = set()     # (inst, target)
        have_image: Set[str] = set()                  # target
        power_avail: Set[str] = set()                 # sat
        storage_avail: Set[str] = set()               # sat
        visible: Set[Tuple[str, str]] = set()         # (sat, gs)

        for pred in state:
            name = pred.name
            params = pred.params

            if name == "pointing":
                s, d = params
                pointing[s] = d

            elif name == "onboard":
                i, s = params
                onboard[i] = s

            elif name == "calibrated":
                (i,) = params
                calibrated.add(i)

            elif name == "supports":
                i, t = params
                supports.add((i, t))

            elif name == "calibration-target":
                i, t = params
                calibration_target.add((i, t))

            elif name == "image-taken":
                i, t = params
                image_taken.add((i, t))

            elif name == "have-image":
                (t,) = params
                have_image.add(t)

            elif name == "power-avail":
                (s,) = params
                power_avail.add(s)

            elif name == "storage-avail":
                (s,) = params
                storage_avail.add(s)

            elif name == "visible":
                s, g = params
                visible.add((s, g))

        # ------------------------------------------------------------
        # 3) Layout rules (simple, consistent)
        # ------------------------------------------------------------
        # Coordinates are arbitrary units (like other renderers).
        # We place:
        # - Targets at the top row
        # - Satellites center row
        # - Directions + Instruments below satellites
        # - Groundstations bottom row

        positions: Dict[str, List[float]] = {}

        # Targets row
        for idx, t in enumerate(targets):
            positions[t] = [idx * 2.5, -4.0]

        # Satellites row
        for idx, s in enumerate(satellites):
            positions[s] = [idx * 6.0, 0.0]

        # Groundstations row
        for idx, g in enumerate(groundstations):
            positions[g] = [idx * 6.0, 6.0]

        # Directions: put used directions under satellites (dedup)
        used_dirs = sorted(set(pointing.values()), key=lambda x: (num_suffix(x), x))
        for idx, d in enumerate(used_dirs):
            positions[d] = [idx * 3.5, 2.5]

        # Instruments: placed near their satellite
        by_sat: Dict[str, List[str]] = {}
        for i in instruments:
            s = onboard.get(i)
            if s:
                by_sat.setdefault(s, []).append(i)
        for s in by_sat:
            by_sat[s].sort(key=lambda x: (num_suffix(x), x))

        # ------------------------------------------------------------
        # 4) Create VisualObjects
        # ------------------------------------------------------------
        # Targets
        for t in targets:
            pos = positions.get(t, [0.0, -4.0])
            visual_objects.append(
                VisualObject(
                    id=t,
                    type="target",
                    label=t.upper(),
                    position=pos,
                    properties={
                        "color": self.colors["target"],
                        "have_image": (t in have_image),
                    }
                )
            )

        # Satellites
        for s in satellites:
            pos = positions.get(s, [0.0, 0.0])
            visual_objects.append(
                VisualObject(
                    id=s,
                    type="satellite",
                    label=s.upper(),
                    position=pos,
                    properties={
                        "color": self.colors["satellite"],
                        "power": (s in power_avail),
                        "storage": (s in storage_avail),
                        "pointing": pointing.get(s),
                    }
                )
            )

        # Directions (only those used)
        for d in used_dirs:
            pos = positions.get(d, [0.0, 2.5])
            visual_objects.append(
                VisualObject(
                    id=d,
                    type="direction",
                    label=d.upper(),
                    position=pos,
                    properties={"color": self.colors["direction"]}
                )
            )

        # Groundstations
        for g in groundstations:
            pos = positions.get(g, [0.0, 6.0])
            visual_objects.append(
                VisualObject(
                    id=g,
                    type="groundstation",
                    label=g.upper(),
                    position=pos,
                    properties={"color": self.colors["groundstation"]}
                )
            )

        # Instruments (near satellites)
        for s, insts in by_sat.items():
            base = positions.get(s, [0.0, 0.0])
            # place instruments in a small row under the satellite
            for j, i in enumerate(insts):
                pos = [base[0] + (j * 1.2) - ((len(insts) - 1) * 0.6), base[1] + 2.5]
                positions[i] = pos
                # list targets this instrument supports (nice for tooltip)
                supp = sorted([t for (ii, t) in supports if ii == i], key=lambda x: (num_suffix(x), x))
                calt = sorted([t for (ii, t) in calibration_target if ii == i], key=lambda x: (num_suffix(x), x))
                imgs = sorted([t for (ii, t) in image_taken if ii == i], key=lambda x: (num_suffix(x), x))

                visual_objects.append(
                    VisualObject(
                        id=i,
                        type="instrument",
                        label=i.upper(),
                        position=pos,
                        properties={
                            "color": self.colors["instrument"],
                            "calibrated": (i in calibrated),
                            "supports": supp,
                            "calibration_target": calt,
                            "images": imgs,
                        }
                    )
                )

        # ------------------------------------------------------------
        # 5) Create VisualRelations (facts)
        # ------------------------------------------------------------
        # Onboard: instrument -> satellite
        for i, s in onboard.items():
            visual_relations.append(
                VisualRelation(
                    type="onboard",
                    source=i,
                    target=s,
                    properties={"description": f"{i} onboard {s}"}
                )
            )

        # Pointing: satellite -> direction
        for s, d in pointing.items():
            visual_relations.append(
                VisualRelation(
                    type="pointing",
                    source=s,
                    target=d,
                    properties={"description": f"{s} pointing {d}"}
                )
            )

        # image-taken: instrument -> target
        for (i, t) in image_taken:
            visual_relations.append(
                VisualRelation(
                    type="image-taken",
                    source=i,
                    target=t,
                    properties={"description": f"{i} took image of {t}"}
                )
            )

        # have-image: target communicated/available (like rovers communicated)
        for t in have_image:
            visual_relations.append(
                VisualRelation(
                    type="have-image",
                    source=t,
                    target=None,
                    properties={"description": f"have image of {t}"}
                )
            )

        # visible: satellite -> groundstation (communication possible)
        for (s, g) in visible:
            visual_relations.append(
                VisualRelation(
                    type="visible",
                    source=s,
                    target=g,
                    properties={
                        "description": f"{s} visible {g}",
                        "color": self.colors["path"]
                    }
                )
            )

        return RenderedState(
            domain=self.domain_name,
            objects=visual_objects,
            relations=visual_relations,
            metadata=metadata
        )
