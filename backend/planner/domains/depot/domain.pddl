(define (domain depot)
  (:requirements :strips :typing)
  (:types
      location
      depot distributor - location
      truck
      package
  )

  (:predicates
      (at ?p - package ?l - location)
      (at-truck ?t - truck ?l - location)
      (in-truck ?p - package ?t - truck)
  )

  (:action drive
    :parameters (?t - truck ?from - location ?to - location)
    :precondition (at-truck ?t ?from)
    :effect (and
      (not (at-truck ?t ?from))
      (at-truck ?t ?to))
  )

  (:action load
    :parameters (?p - package ?t - truck ?l - location)
    :precondition (and
      (at ?p ?l)
      (at-truck ?t ?l))
    :effect (and
      (not (at ?p ?l))
      (in-truck ?p ?t))
  )

  (:action unload
    :parameters (?p - package ?t - truck ?l - location)
    :precondition (and
      (in-truck ?p ?t)
      (at-truck ?t ?l))
    :effect (and
      (not (in-truck ?p ?t))
      (at ?p ?l))
  )
)
