(define (domain rovers)
  (:requirements :strips :typing)
  (:types
    rover
    waypoint
    target
  )

  (:predicates
    ;; rover location
    (at-rover ?r - rover ?w - waypoint)

    ;; map connectivity
    (connected ?from - waypoint ?to - waypoint)

    ;; targets are located at waypoints
    (at-target ?t - target ?w - waypoint)

    ;; rover camera calibrated?
    (calibrated ?r - rover)

    ;; rover has already taken an image of target
    (have-image ?r - rover ?t - target)

    ;; image has been communicated
    (communicated ?t - target)
  )

  (:action navigate
    :parameters (?r - rover ?from - waypoint ?to - waypoint)
    :precondition (and
      (at-rover ?r ?from)
      (connected ?from ?to)
    )
    :effect (and
      (not (at-rover ?r ?from))
      (at-rover ?r ?to)
    )
  )

  (:action calibrate
    :parameters (?r - rover ?w - waypoint)
    :precondition (at-rover ?r ?w)
    :effect (calibrated ?r)
  )

  (:action take-image
    :parameters (?r - rover ?t - target ?w - waypoint)
    :precondition (and
      (at-rover ?r ?w)
      (at-target ?t ?w)
      (calibrated ?r)
    )
    :effect (have-image ?r ?t)
  )

  (:action communicate
    :parameters (?r - rover ?t - target)
    :precondition (have-image ?r ?t)
    :effect (communicated ?t)
  )
)
