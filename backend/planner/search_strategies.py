"""
Search Strategy Configuration for Fast Downward

This module defines the whitelist of supported search strategies with metadata
for UI display and runtime characteristics.

SECURITY NOTE: Only strategies defined here can be executed. The backend maps
strategy IDs to actual Fast Downward arguments - raw CLI arguments are never
accepted from the frontend.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class SearchStrategy:
    """Configuration for a Fast Downward search strategy."""
    id: str                      # Unique identifier (sent from frontend)
    name: str                    # Display name
    description: str             # One-line description
    is_optimal: bool             # Whether it guarantees optimal solutions
    speed: str                   # "fast", "medium", "slow"
    when_to_use: str             # Guidance for users
    fd_args: List[str]           # Actual Fast Downward arguments
    warning: Optional[str]       # Warning message for UI (if any)


# Whitelist of supported search strategies
# These are curated based on common Fast Downward configurations
SEARCH_STRATEGIES: Dict[str, SearchStrategy] = {
    
    # ============== OPTIMAL STRATEGIES ==============
    
    "astar-lmcut": SearchStrategy(
        id="astar-lmcut",
        name="A* + LM-cut (Optimal)",
        description="Optimal search using A* with landmark-cut heuristic",
        is_optimal=True,
        speed="slow",
        when_to_use="When you need the shortest possible plan and can wait",
        fd_args=["--search", "astar(lmcut())"],
        warning="⚠️ Optimal search can be very slow for large problems (10+ objects). Consider using a satisficing strategy for faster results."
    ),
    
    "astar-blind": SearchStrategy(
        id="astar-blind",
        name="A* Blind (Optimal)",
        description="Optimal search with no heuristic (breadth-first behavior)",
        is_optimal=True,
        speed="slow",
        when_to_use="For very small problems or when other heuristics fail",
        fd_args=["--search", "astar(blind())"],
        warning="⚠️ Blind search explores all states - only suitable for tiny problems."
    ),
    
    "astar-hmax": SearchStrategy(
        id="astar-hmax",
        name="A* + h^max (Optimal)",
        description="Optimal search using A* with h^max heuristic",
        is_optimal=True,
        speed="slow",
        when_to_use="Alternative optimal search when LM-cut is too slow",
        fd_args=["--search", "astar(hmax())"],
        warning="⚠️ Optimal search can be very slow for large problems."
    ),
    
    # ============== SATISFICING STRATEGIES (FAST) ==============
    
    "greedy-ff": SearchStrategy(
        id="greedy-ff",
        name="Greedy Best-First + FF (Fast)",
        description="Fast satisficing search using FF heuristic",
        is_optimal=False,
        speed="fast",
        when_to_use="Best for quick results on medium to large problems",
        fd_args=["--search", "eager_greedy([ff()])"],
        warning=None
    ),
    
    "lazy-greedy-ff": SearchStrategy(
        id="lazy-greedy-ff",
        name="Lazy Greedy + FF (Very Fast)",
        description="Lazy evaluation greedy search - fastest option",
        is_optimal=False,
        speed="fast",
        when_to_use="When speed is the priority and plan quality is secondary",
        fd_args=["--search", "lazy_greedy([ff()], preferred=[ff()])"],
        warning=None
    ),
    
    "greedy-add": SearchStrategy(
        id="greedy-add",
        name="Greedy Best-First + h^add (Fast)",
        description="Fast satisficing search using additive heuristic",
        is_optimal=False,
        speed="fast",
        when_to_use="Alternative fast search when FF doesn't work well",
        fd_args=["--search", "eager_greedy([add()])"],
        warning=None
    ),
    
    # ============== SATISFICING STRATEGIES (BALANCED) ==============
    
    "lama-first": SearchStrategy(
        id="lama-first",
        name="LAMA-first (Balanced)",
        description="First solution from LAMA - good balance of speed and quality",
        is_optimal=False,
        speed="medium",
        when_to_use="Good default choice for most problems",
        fd_args=["--search", "lazy_greedy([ff(), cea()], preferred=[ff(), cea()])"],
        warning=None
    ),
    
    "greedy-cea": SearchStrategy(
        id="greedy-cea",
        name="Greedy + CEA (Balanced)",
        description="Greedy search with context-enhanced additive heuristic",
        is_optimal=False,
        speed="medium",
        when_to_use="When FF-based searches struggle with the domain",
        fd_args=["--search", "eager_greedy([cea()])"],
        warning=None
    ),
    
    # ============== WEIGHTED A* (BOUNDED SUBOPTIMAL) ==============
    
    "wastar-ff-3": SearchStrategy(
        id="wastar-ff-3",
        name="Weighted A* (w=3) + FF",
        description="Bounded suboptimal search - at most 3x optimal cost",
        is_optimal=False,
        speed="medium",
        when_to_use="When you want better quality than greedy but faster than optimal",
        fd_args=["--search", "astar(ff(), w=3)"],
        warning=None
    ),
    
    "wastar-lmcut-2": SearchStrategy(
        id="wastar-lmcut-2",
        name="Weighted A* (w=2) + LM-cut",
        description="Bounded suboptimal search - at most 2x optimal cost",
        is_optimal=False,
        speed="medium",
        when_to_use="Good compromise between optimality and speed",
        fd_args=["--search", "astar(lmcut(), w=2)"],
        warning=None
    ),
}


def get_strategy(strategy_id: str) -> Optional[SearchStrategy]:
    """
    Get a search strategy by ID.
    
    Args:
        strategy_id: The strategy identifier
        
    Returns:
        SearchStrategy if found, None otherwise
    """
    return SEARCH_STRATEGIES.get(strategy_id)


def get_all_strategies() -> List[SearchStrategy]:
    """
    Get all available search strategies.
    
    Returns:
        List of all SearchStrategy objects
    """
    return list(SEARCH_STRATEGIES.values())


def get_strategy_ids() -> List[str]:
    """
    Get list of all valid strategy IDs.
    
    Returns:
        List of strategy ID strings
    """
    return list(SEARCH_STRATEGIES.keys())


def validate_strategy(strategy_id: str) -> bool:
    """
    Validate that a strategy ID is in the whitelist.
    
    Args:
        strategy_id: The strategy identifier to validate
        
    Returns:
        True if valid, False otherwise
    """
    return strategy_id in SEARCH_STRATEGIES


def get_default_strategy_id() -> str:
    """
    Get the default strategy ID.
    
    Returns:
        The default strategy ID (lazy-greedy-ff for fast results)
    """
    return "lazy-greedy-ff"


def get_strategies_for_api() -> List[dict]:
    """
    Get strategies formatted for API response.
    
    Returns:
        List of strategy dictionaries suitable for JSON serialization
    """
    return [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "isOptimal": s.is_optimal,
            "speed": s.speed,
            "whenToUse": s.when_to_use,
            "warning": s.warning,
        }
        for s in SEARCH_STRATEGIES.values()
    ]
