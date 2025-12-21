from typing import Dict, List, Set, Optional
from .base_renderer import BaseStateRenderer, RenderedState, VisualObject, VisualRelation


class HanoiRenderer(BaseStateRenderer):
    """
    Renderer for the Tower of Hanoi planning domain.
    """

    def __init__(self):
        super().__init__("hanoi")
        self.colors = {
            "peg": "#8B4513",     # Brown
            "disk": "#4ECDC4",    # Teal (all disks same size/color)
        }

    def render(self, state: Set, objects: Dict[str, str], metadata: Optional[Dict] = None) -> RenderedState:

        visual_objects: List[VisualObject] = []
        visual_relations: List[VisualRelation] = []

        # --- collect pegs and disks ---
        pegs = sorted([o for o, t in objects.items() if t == "peg"])
        disks = sorted([o for o, t in objects.items() if t == "disk"])

        # fixed x positions for pegs
        peg_x = {peg: i * 3 for i, peg in enumerate(pegs)}

        # --- group disks by peg ---
        disks_on_peg: Dict[str, List[str]] = {peg: [] for peg in pegs}

        for pred in state:
            if pred.name == "on":
                disk, peg = pred.params
                disks_on_peg[peg].append(disk)

                visual_relations.append(
                    VisualRelation(
                        type="on",
                        source=disk,
                        target=peg,
                        properties={"description": f"{disk} on {peg}"}
                    )
                )

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

        # --- create disk objects (stacked vertically) ---
        for peg, disks_list in disks_on_peg.items():
            for height, disk in enumerate(disks_list):
                visual_objects.append(
                    VisualObject(
                        id=disk,
                        type="disk",
                        label=disk.upper(),
                        position=[peg_x[peg], height + 1],
                        properties={
                            "color": self.colors["disk"],
                            "peg": peg
                        }
                    )
                )

        return RenderedState(
            domain=self.domain_name,
            objects=visual_objects,
            relations=visual_relations,
            metadata=metadata
        )
