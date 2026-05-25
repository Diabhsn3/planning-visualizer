(define (domain logistics)
  (:requirements :strips :typing)
  (:types
    package vehicle location city - object
    truck airplane - vehicle
    airport - location
  )

  (:predicates
    (in-city ?l - location ?c - city)
    (at-loc ?obj - vehicle ?l - location)
    (at-pkg ?p - package ?l - location)
    (in ?p - package ?v - vehicle)
  )

  (:action load-truck
    :parameters (?pkg - package ?truck - truck ?loc - location)
    :precondition (and (at-loc ?truck ?loc) (at-pkg ?pkg ?loc))
    :effect (and (not (at-pkg ?pkg ?loc)) (in ?pkg ?truck))
  )

  (:action load-airplane
    :parameters (?pkg - package ?airplane - airplane ?loc - airport)
    :precondition (and (at-pkg ?pkg ?loc) (at-loc ?airplane ?loc))
    :effect (and (not (at-pkg ?pkg ?loc)) (in ?pkg ?airplane))
  )

  (:action unload-truck
    :parameters (?pkg - package ?truck - truck ?loc - location)
    :precondition (and (at-loc ?truck ?loc) (in ?pkg ?truck))
    :effect (and (not (in ?pkg ?truck)) (at-pkg ?pkg ?loc))
  )

  (:action unload-airplane
    :parameters (?pkg - package ?airplane - airplane ?loc - airport)
    :precondition (and (in ?pkg ?airplane) (at-loc ?airplane ?loc))
    :effect (and (not (in ?pkg ?airplane)) (at-pkg ?pkg ?loc))
  )

  (:action drive-truck
    :parameters (?truck - truck ?from - location ?to - location ?c - city)
    :precondition (and (at-loc ?truck ?from) (in-city ?from ?c) (in-city ?to ?c))
    :effect (and (not (at-loc ?truck ?from)) (at-loc ?truck ?to))
  )

  (:action fly-airplane
    :parameters (?airplane - airplane ?from - airport ?to - airport)
    :precondition (at-loc ?airplane ?from)
    :effect (and (not (at-loc ?airplane ?from)) (at-loc ?airplane ?to))
  )
)
