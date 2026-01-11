(define (domain logistics)
  (:requirements :strips :typing)
  (:types
    package truck airplane location city
  )

  (:predicates
    ;; package state
    (at ?p - package ?l - location)
    (in ?p - package ?v - (either truck airplane))

    ;; vehicle state
    (at-truck ?t - truck ?l - location)
    (at-airplane ?a - airplane ?l - location)

    ;; map structure
    (in-city ?l - location ?c - city)
    (airport ?l - location)
  )

  ;; --- Load/Unload with Trucks (within a city) ---
  (:action load-truck
    :parameters (?p - package ?t - truck ?l - location)
    :precondition (and (at ?p ?l) (at-truck ?t ?l))
    :effect (and (in ?p ?t) (not (at ?p ?l)))
  )

  (:action unload-truck
    :parameters (?p - package ?t - truck ?l - location)
    :precondition (and (in ?p ?t) (at-truck ?t ?l))
    :effect (and (at ?p ?l) (not (in ?p ?t)))
  )

  ;; --- Load/Unload with Airplanes (at airports) ---
  (:action load-airplane
    :parameters (?p - package ?a - airplane ?l - location)
    :precondition (and (at ?p ?l) (at-airplane ?a ?l) (airport ?l))
    :effect (and (in ?p ?a) (not (at ?p ?l)))
  )

  (:action unload-airplane
    :parameters (?p - package ?a - airplane ?l - location)
    :precondition (and (in ?p ?a) (at-airplane ?a ?l) (airport ?l))
    :effect (and (at ?p ?l) (not (in ?p ?a)))
  )

  ;; --- Truck movement: only inside the same city ---
  (:action drive-truck
    :parameters (?t - truck ?from - location ?to - location ?c - city)
    :precondition (and
      (at-truck ?t ?from)
      (in-city ?from ?c)
      (in-city ?to ?c)
    )
    :effect (and
      (at-truck ?t ?to)
      (not (at-truck ?t ?from))
    )
  )

  ;; --- Airplane movement: only between airports ---
  (:action fly-airplane
    :parameters (?a - airplane ?from - location ?to - location)
    :precondition (and
      (at-airplane ?a ?from)
      (airport ?from)
      (airport ?to)
    )
    :effect (and
      (at-airplane ?a ?to)
      (not (at-airplane ?a ?from))
    )
  )
)