# backend/planner/state_renderer/rovers_renderer.py

from typing import Dict, List, Optional, Set
from .base_renderer import BaseStateRenderer, RenderedState, VisualObject, VisualRelation


class RoversRenderer(BaseStateRenderer):
    """
    Renderer for the Rovers planning domain.
    Converts planning states into visual objects and relations.
    """

    def __init__(self):
        super().__init__("rovers")
        self.colors = {
            "rover": "#FF6B6B",        # Red
            "waypoint": "#95E1D3",     # Light green
            "target": "#FFE66D",       # Yellow
            "path": "rgba(0,0,0,0.20)" # Gray-ish
        }

    def render(
        self,
        state: Set,
        objects: Dict[str, str],
        metadata: Optional[Dict] = None
    ) -> RenderedState:
        """
        Render a rovers state as a visual representation.

        Args:
            state: Set of predicates representing the state
            objects: Dictionary mapping object names to types
            metadata: Optional metadata (step number, action)

        Returns:
            RenderedState object with visual elements
        """
        visual_objects: List[VisualObject] = []
        visual_relations: List[VisualRelation] = []

        # ------------------------------------------------------------
        # 1) Collect objects by type
        # ------------------------------------------------------------
        rovers = [name for name, typ in objects.items() if typ == "rover"]
        waypoints = [name for name, typ in objects.items() if typ == "waypoint"]
        targets = [name for name, typ in objects.items() if typ == "target"]

        # Defensive: sometimes parser mistakenly includes type names as objects
        rovers = [r for r in rovers if r not in ["rover", "waypoint", "target"]]
        waypoints = [w for w in waypoints if w not in ["rover", "waypoint", "target"]]
        targets = [t for t in targets if t not in ["rover", "waypoint", "target"]]

        # ------------------------------------------------------------
        # 2) Parse predicates into useful maps/sets
        # ------------------------------------------------------------
        rover_at: Dict[str, str] = {}           # r -> w
        target_at: Dict[str, str] = {}          # t -> w
        calibrated: Set[str] = set()            # set of rovers
        have_image: Set[tuple] = set()          # (r, t)
        communicated: Set[str] = set()          # set of targets
        connections: Set[tuple] = set()         # (w1, w2) directed, but we can dedup

        for pred in state:
            name = pred.name
            params = pred.params

            if name == "at-rover":
                r, w = params
                rover_at[r] = w

            elif name == "at-target":
                t, w = params
                target_at[t] = w

            elif name == "calibrated":
                (r,) = params
                calibrated.add(r)

            elif name == "have-image":
                r, t = params
                have_image.add((r, t))

            elif name == "communicated":
                (t,) = params
                communicated.add(t)

            elif name == "connected":
                w1, w2 = params
                # normalize undirected edge: store sorted to avoid duplicates
                a, b = sorted([w1, w2])
                connections.add((a, b))

        # ------------------------------------------------------------
        # 3) Layout: give each waypoint a position (grid-like)
        # ------------------------------------------------------------
        # Sort waypoints by numeric suffix if possible: w1,w2,w3...
        def num_suffix(x: str) -> int:
            import re
            m = re.search(r"(\d+)$", x)
            return int(m.group(1)) if m else 9999

        waypoints_sorted = sorted(waypoints, key=lambda w: (num_suffix(w), w))

        # Simple layout: place waypoints in a row/2-rows grid
        # (works well for small-medium maps; you can upgrade later)
        cols = max(3, min(6, len(waypoints_sorted)))
        positions: Dict[str, List[float]] = {}

        for idx, w in enumerate(waypoints_sorted):
            gx = idx % cols
            gy = idx // cols
            positions[w] = [gx * 2.0, gy * 2.0]  # spacing

        # ------------------------------------------------------------
        # 4) Create VisualObjects (waypoints, rovers, targets)
        # ------------------------------------------------------------
        # Waypoints
        for w in waypoints_sorted:
            visual_objects.append(
                VisualObject(
                    id=w,
                    type="waypoint",
                    label=w.upper(),
                    position=positions.get(w),
                    properties={"color": self.colors["waypoint"]}
                )
            )

        # Targets (place near their waypoint)
        target_sorted = sorted(targets, key=lambda t: (num_suffix(t), t))
        for t in target_sorted:
            w = target_at.get(t)
            base = positions.get(w, [0.0, 0.0])
            # offset target slightly to the right/down of its waypoint
            pos = [base[0] + 0.6, base[1] + 0.6]

            visual_objects.append(
                VisualObject(
                    id=t,
                    type="target",
                    label=t.upper(),
                    position=pos,
                    properties={
                        "color": self.colors["target"],
                        "communicated": t in communicated
                    }
                )
            )

        # Rovers (place near their waypoint)
        rover_sorted = sorted(rovers, key=lambda r: (num_suffix(r), r))
        for r in rover_sorted:
            w = rover_at.get(r)
            base = positions.get(w, [0.0, 0.0])
            # offset rover slightly to the left/up of its waypoint
            pos = [base[0] - 0.6, base[1] - 0.6]

            # which targets does this rover have images of?
            imgs = [t for (rr, t) in have_image if rr == r]

            visual_objects.append(
                VisualObject(
                    id=r,
                    type="rover",
                    label=r.upper(),
                    position=pos,
                    properties={
                        "color": self.colors["rover"],
                        "calibrated": r in calibrated,
                        "images": imgs
                    }
                )
            )

        # ------------------------------------------------------------
        # 5) Create VisualRelations (edges & facts)
        # ------------------------------------------------------------
        # Connections between waypoints
        for (w1, w2) in connections:
            visual_relations.append(
                VisualRelation(
                    type="connected",
                    source=w1,
                    target=w2,
                    properties={"color": self.colors["path"]}
                )
            )

        # Rover at waypoint
        for r, w in rover_at.items():
            visual_relations.append(
                VisualRelation(
                    type="at-rover",
                    source=r,
                    target=w,
                    properties={"description": f"{r} at {w}"}
                )
            )

        # Target at waypoint
        for t, w in target_at.items():
            visual_relations.append(
                VisualRelation(
                    type="at-target",
                    source=t,
                    target=w,
                    properties={"description": f"{t} at {w}"}
                )
            )

        # have-image relations
        for (r, t) in have_image:
            visual_relations.append(
                VisualRelation(
                    type="have-image",
                    source=r,
                    target=t,
                    properties={"description": f"{r} has image of {t}"}
                )
            )

        # communicated relations (target communicated)
        for t in communicated:
            visual_relations.append(
                VisualRelation(
                    type="communicated",
                    source=t,
                    target=None,
                    properties={"description": f"{t} communicated"}
                )
            )

        return RenderedState(
            domain=self.domain_name,
            objects=visual_objects,
            relations=visual_relations,
            metadata=metadata
        )
