from typing import Dict, List, Set, Optional, Any

from .base_renderer import BaseStateRenderer, RenderedState, VisualObject, VisualRelation


class HanoiRenderer(BaseStateRenderer):
    """
    Renderer for the Tower of Hanoi planning domain.

    Supports domains where:
      - objects contain types "disk" and "peg"
      - state contains predicate: (on <disk> <place>) where <place> is a peg OR a disk

    Renders by reconstructing stacks from the on-relations.
    """

    def __init__(self):
        super().__init__("hanoi")
        self.colors = {
            "peg": "#8B4513",   # Brown
            "disk": "#4ECDC4",  # Teal
        }

    def render(
        self,
        state: Set,
        objects: Dict[str, str],
        metadata: Optional[Dict] = None
    ) -> RenderedState:

        visual_objects: List[VisualObject] = []
        visual_relations: List[VisualRelation] = []

        # --- collect pegs and disks from typed objects ---
        pegs = sorted([o for o, t in objects.items() if t == "peg"])
        disks = sorted([o for o, t in objects.items() if t == "disk"])

        # fixed x positions for pegs
        peg_x = {peg: i * 3 for i, peg in enumerate(pegs)}

        # --- parse state into a usable form ---
        # on_map[disk] = support (peg or disk)
        on_map: Dict[str, str] = {}

        for pred in state:
            # pred is expected to have .name and .params
            if getattr(pred, "name", None) == "on":
                params = getattr(pred, "params", None)
                if not params or len(params) != 2:
                    continue

                disk, support = params[0], params[1]

                # Be defensive: only accept on-relations where the first param is a disk we know
                if disk in disks:
                    on_map[disk] = support

                # Always record the relation (even if support is a disk)
                visual_relations.append(
                    VisualRelation(
                        type="on",
                        source=disk,
                        target=support,
                        properties={"description": f"{disk} on {support}"}
                    )
                )

        # Build inverse mapping: support -> disk_that_is_on_it
        # In valid Hanoi states, each support has at most one disk on it.
        support_to_disk: Dict[str, str] = {}
        for d, s in on_map.items():
            support_to_disk[s] = d

        # --- create peg objects ---
        for peg in pegs:
            visual_objects.append(
                VisualObject(
                    id=peg,
                    type="peg",
                    label=peg.upper(),
                    position=[peg_x[peg], 0],
                    properties={"color": self.colors["peg"]}
                )
            )

        # --- reconstruct stacks per peg and place disks ---
        # For each peg: walk upward peg -> disk -> disk -> ...
        for peg in pegs:
            height = 1
            current_support = peg

            while current_support in support_to_disk:
                disk = support_to_disk[current_support]

                visual_objects.append(
                    VisualObject(
                        id=disk,
                        type="disk",
                        label=disk.upper(),
                        position=[peg_x[peg], height],
                        properties={
                            "color": self.colors["disk"],
                            "peg": peg,
                            "support": current_support,
                            "height": height,
                        }
                    )
                )

                height += 1
                current_support = disk  # next disk (if any) sits on this disk

        # Optional: handle "floating" disks (in case of inconsistent state)
        # Put them off to the side so they still appear rather than disappearing.
        rendered_disk_ids = {obj.id for obj in visual_objects if obj.type == "disk"}
        floating = [d for d in disks if d not in rendered_disk_ids]
        if floating:
            # place to the right of last peg
            base_x = (len(pegs) * 3) if pegs else 0
            for i, d in enumerate(sorted(floating)):
                visual_objects.append(
                    VisualObject(
                        id=d,
                        type="disk",
                        label=d.upper(),
                        position=[base_x + 2, i + 1],
                        properties={
                            "color": self.colors["disk"],
                            "peg": None,
                            "support": on_map.get(d),
                            "warning": "floating_or_inconsistent_state",
                        }
                    )
                )

        return RenderedState(
            domain=self.domain_name,
            objects=visual_objects,
            relations=visual_relations,
            metadata=metadata
        )
