from typing import Dict, List, Any, Set, Optional
from .base_renderer import BaseStateRenderer, RenderedState, VisualObject, VisualRelation


class DepotRenderer(BaseStateRenderer):
    """
    Renderer for the Depot planning domain.
    Converts planning states into visual objects and relations.
    """

    def __init__(self):
        super().__init__("depot")
        self.colors = {
            "depot": "#A9A9A9",
            "truck": "#00BFFF",
            "crane": "#FF69B4",
            "pile": "#8B4513",
            "package": "#FFD700",
        }

    def render(self, state: Set, objects: Dict[str, str], metadata: Optional[Dict] = None) -> RenderedState:

        visual_objects = []
        visual_relations = []

        # -------------------------------------------------
        # 1. Layout rules
        # -------------------------------------------------

        depot_positions = {}
        depot_index = 0

        # assign fixed positions for depots
        for obj, typ in objects.items():
            if typ == "depot":
                depot_positions[obj] = [depot_index * 8, 0]
                depot_index += 1

        # default offsets inside each depot
        pile_offsets = {}
        crane_offsets = {}
        truck_offsets = {}

        # -------------------------------------------------
        # 2. Create Visual Objects
        # -------------------------------------------------

        for obj_name, obj_type in objects.items():

            if obj_type not in self.colors:
                continue

            color = self.colors[obj_type]

            # --- Positioning rules ---
            if obj_type == "depot":
                pos = depot_positions[obj_name]

            elif obj_type == "pile":
                # place piles near their depot later via relation
                pos = [0, 0]

            elif obj_type == "crane":
                pos = [0, 0]

            elif obj_type == "truck":
                pos = [0, -2]

            elif obj_type == "package":
                pos = [0, 2]

            else:
                pos = [0, 0]

            visual_objects.append(VisualObject(
                id=obj_name,
                type=obj_type,
                label=obj_name,
                position=pos,
                properties={"color": color}
            ))

        # -------------------------------------------------
        # 3. Create Relations from predicates
        # -------------------------------------------------

        for pred in state:
            name = pred.name
            params = pred.params

            # --- Truck at depot ---
            if name == "at-truck":
                truck, depot = params
                visual_relations.append(VisualRelation(
                    type="at-truck",
                    source=truck,
                    target=depot,
                    properties={"description": f"{truck} at {depot}"}
                ))

            # --- Crane at depot ---
            elif name == "at-crane":
                crane, depot = params
                visual_relations.append(VisualRelation(
                    type="at-crane",
                    source=crane,
                    target=depot,
                    properties={"description": f"{crane} at {depot}"}
                ))

            # --- Package on pile ---
            elif name == "on-pile":
                pkg, pile = params
                visual_relations.append(VisualRelation(
                    type="on-pile",
                    source=pkg,
                    target=pile,
                    properties={"description": f"{pkg} on {pile}"}
                ))

            # --- Package on package (stacking) ---
            elif name == "on":
                pkg1, pkg2 = params
                visual_relations.append(VisualRelation(
                    type="on",
                    source=pkg1,
                    target=pkg2,
                    properties={"description": f"{pkg1} on {pkg2}"}
                ))

            # --- Package in truck ---
            elif name == "in-truck":
                pkg, truck = params
                visual_relations.append(VisualRelation(
                    type="in-truck",
                    source=pkg,
                    target=truck,
                    properties={"description": f"{pkg} in {truck}"}
                ))

            # --- Crane holding package ---
            elif name == "holding":
                crane, pkg = params
                visual_relations.append(VisualRelation(
                    type="holding",
                    source=crane,
                    target=pkg,
                    properties={"description": f"{crane} holding {pkg}"}
                ))

        # -------------------------------------------------
        return RenderedState(
            domain=self.domain_name,
            objects=visual_objects,
            relations=visual_relations,
            metadata=metadata
        )
