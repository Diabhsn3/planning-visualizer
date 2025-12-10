"""
Gripper State Renderer - domain-specific rendering for gripper domain.

Renders rooms, robot, grippers, and balls with spatial layout.
"""

from typing import Dict, List, Set, Optional
from .base_renderer import BaseStateRenderer, RenderedState, VisualObject, VisualRelation


class GripperRenderer(BaseStateRenderer):
    """
    Renderer for Gripper domain.
    
    Features:
    - Room layout (side by side)
    - Robot with two grippers
    - Balls in rooms or grippers
    - Movement visualization
    """
    
    BALL_COLORS = {
        'ball-1': '#FF6B6B',  # Red
        'ball-2': '#4ECDC4',  # Teal
        'ball-3': '#45B7D1',  # Blue
        'ball-4': '#FFA07A',  # Salmon
        'ball-5': '#FFD93D',  # Yellow
        'ball-6': '#95E1D3',  # Mint
        'ball-7': '#F38181',  # Pink
        'ball-8': '#AA96DA',  # Purple
    }
    
    ROOM_COLORS = {
        'room-a': '#E8F5E9',  # Light Green
        'room-b': '#E3F2FD',  # Light Blue
        'room-c': '#FFF3E0',  # Light Orange
        'room-d': '#F3E5F5',  # Light Purple
    }
    
    def __init__(self):
        super().__init__("gripper")
        self.room_width = 200
        self.room_height = 300
        self.room_spacing = 100
        self.ball_size = 30
        self.gripper_size = 40
    
    def render(self, state: Set, objects: Dict[str, str], metadata: Optional[Dict] = None) -> RenderedState:
        """
        Render gripper domain state with spatial layout.
        
        Args:
            state: Set of predicates
            objects: Object name to type mapping
            metadata: Optional metadata
            
        Returns:
            RenderedState with positioned objects
        """
        # Extract objects by type
        rooms = {name for name, obj_type in objects.items() 
                if obj_type == 'room' and name != 'room'}
        balls = {name for name, obj_type in objects.items() 
                if obj_type == 'ball' and name != 'ball'}
        grippers = {name for name, obj_type in objects.items() 
                   if obj_type == 'gripper' and name != 'gripper'}
        
        # Parse state predicates
        robot_at = None        # room where robot is
        ball_at = {}           # ball -> room
        ball_carry = {}        # ball -> gripper
        gripper_free = set()   # free grippers
        
        for pred in state:
            if pred.name == 'at-robby' and len(pred.params) == 1:
                robot_at = pred.params[0]
            elif pred.name == 'at' and len(pred.params) == 2:
                ball_at[pred.params[0]] = pred.params[1]
            elif pred.name == 'carry' and len(pred.params) == 2:
                ball_carry[pred.params[0]] = pred.params[1]
            elif pred.name == 'free' and len(pred.params) == 1:
                gripper_free.add(pred.params[0])
        
        visual_objects = []
        visual_relations = []
        
        # Render rooms
        x_offset = 50
        room_positions = {}
        
        for room in sorted(rooms):
            position = [x_offset, 100]
            room_positions[room] = position
            
            color = self.ROOM_COLORS.get(room, '#F5F5F5')
            
            visual_obj = VisualObject(
                id=room,
                type='room',
                label=room.upper(),
                position=position,
                properties={
                    'width': self.room_width,
                    'height': self.room_height,
                    'color': color,
                    'has_robot': room == robot_at
                }
            )
            visual_objects.append(visual_obj)
            
            x_offset += self.room_width + self.room_spacing
        
        # Render robot
        if robot_at and robot_at in room_positions:
            robot_pos = room_positions[robot_at]
            robot_x = robot_pos[0] + self.room_width / 2
            robot_y = robot_pos[1] + self.room_height / 2
            
            robot = VisualObject(
                id='robot',
                type='robot',
                label='Robot',
                position=[robot_x, robot_y],
                properties={
                    'width': 60,
                    'height': 80,
                    'color': '#607D8B',
                    'location': robot_at
                }
            )
            visual_objects.append(robot)
            
            # Render grippers attached to robot
            gripper_offset = -30
            for gripper in sorted(grippers):
                gripper_pos = [robot_x + gripper_offset, robot_y - 50]
                
                is_free = gripper in gripper_free
                holding = None
                for ball, grp in ball_carry.items():
                    if grp == gripper:
                        holding = ball
                        break
                
                gripper_obj = VisualObject(
                    id=gripper,
                    type='gripper',
                    label=gripper.upper(),
                    position=gripper_pos,
                    properties={
                        'size': self.gripper_size,
                        'color': '#4CAF50' if is_free else '#FF5722',
                        'free': is_free,
                        'holding': holding
                    }
                )
                visual_objects.append(gripper_obj)
                
                gripper_offset += 60
        
        # Render balls
        for ball in sorted(balls):
            if ball in ball_carry:
                # Ball is being carried by gripper
                gripper = ball_carry[ball]
                # Position near the gripper (will be handled by gripper rendering)
                # Find gripper position
                gripper_pos = None
                for obj in visual_objects:
                    if obj.id == gripper:
                        gripper_pos = obj.position
                        break
                
                if gripper_pos:
                    ball_pos = [gripper_pos[0], gripper_pos[1] + 30]
                else:
                    ball_pos = [0, 0]
                
                status = f"held by {gripper}"
            elif ball in ball_at:
                # Ball is in a room
                room = ball_at[ball]
                if room in room_positions:
                    room_pos = room_positions[room]
                    # Position balls in room (stacked if multiple)
                    balls_in_room = [b for b, r in ball_at.items() if r == room]
                    ball_index = sorted(balls_in_room).index(ball)
                    
                    ball_x = room_pos[0] + 30 + (ball_index * 40)
                    ball_y = room_pos[1] + self.room_height - 50
                    ball_pos = [ball_x, ball_y]
                    status = f"in {room}"
                else:
                    ball_pos = [0, 0]
                    status = "unknown"
            else:
                ball_pos = [0, 0]
                status = "unknown"
            
            color = self.BALL_COLORS.get(ball, '#9E9E9E')
            
            # Extract just the number from ball name (e.g., "ball-1" -> "1")
            ball_label = ball.split('-')[-1] if '-' in ball else ball.upper()
            
            ball_obj = VisualObject(
                id=ball,
                type='ball',
                label=ball_label,
                position=ball_pos,
                properties={
                    'size': self.ball_size,
                    'color': color,
                    'status': status
                }
            )
            visual_objects.append(ball_obj)
        
        # Create relations
        if robot_at:
            relation = VisualRelation(
                type='at-robby',
                source='robot',
                target=robot_at,
                properties={'relationship': 'located_in'}
            )
            visual_relations.append(relation)
        
        for ball, room in ball_at.items():
            relation = VisualRelation(
                type='at',
                source=ball,
                target=room,
                properties={'relationship': 'located_in'}
            )
            visual_relations.append(relation)
        
        for ball, gripper in ball_carry.items():
            relation = VisualRelation(
                type='carry',
                source=gripper,
                target=ball,
                properties={'relationship': 'holding'}
            )
            visual_relations.append(relation)
        
        return RenderedState(
            domain=self.domain_name,
            objects=visual_objects,
            relations=visual_relations,
            metadata=metadata
        )
