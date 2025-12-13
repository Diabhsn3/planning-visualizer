(define (domain logistics)
  (:requirements :strips :typing)
  (:types
      truck airplane location
      city airport - location
      package)

  (:predicates
      (at ?obj - package ?loc - location)
      (at-truck ?t - truck ?c - city)
      (at-plane ?p - airplane ?a - airport)
      (in-truck ?pkg - package ?t - truck)
      (in-plane ?pkg - package ?p - airplane)
  )

  ;; Load/unload truck
  (:action load-truck
     :parameters (?pkg - package ?t - truck ?c - city)
     :precondition (and (at ?pkg ?c) (at-truck ?t ?c))
     :effect (and (not (at ?pkg ?c)) (in-truck ?pkg ?t))
  )

  (:action unload-truck
     :parameters (?pkg - package ?t - truck ?c - city)
     :precondition (and (in-truck ?pkg ?t) (at-truck ?t ?c))
     :effect (and (not (in-truck ?pkg ?t)) (at ?pkg ?c))
  )

  ;; Load/unload plane
  (:action load-airplane
     :parameters (?pkg - package ?p - airplane ?a - airport)
     :precondition (and (at ?pkg ?a) (at-plane ?p ?a))
     :effect (and (not (at ?pkg ?a)) (in-plane ?pkg ?p))
  )

  (:action unload-airplane
     :parameters (?pkg - package ?p - airplane ?a - airport)
     :precondition (and (in-plane ?pkg ?p) (at-plane ?p ?a))
     :effect (and (not (in-plane ?pkg ?p)) (at ?pkg ?a))
  )

  ;; Drive truck inside city
  (:action drive
     :parameters (?t - truck ?from - city ?to - city)
     :precondition (at-truck ?t ?from)
     :effect (and (not (at-truck ?t ?from)) (at-truck ?t ?to))
  )

  ;; Fly plane between airports
  (:action fly
     :parameters (?p - airplane ?from - airport ?to - airport)
     :precondition (at-plane ?p ?from)
     :effect (and (not (at-plane ?p ?from)) (at-plane ?p ?to))
  )
)
