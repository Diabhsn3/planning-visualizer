(define (problem logistics-p1)
  (:domain logistics)
  (:objects
    truck1 - truck
    plane1 - airplane
    pkg1 - package
    apt1 apt2 - airport
    loc1 - location
    cityA cityB - city
  )
  (:init
    (in-city apt1 cityA)
    (in-city apt2 cityB)
    (in-city loc1 cityA)
    (at-loc truck1 loc1)
    (at-loc plane1 apt1)
    (at-pkg pkg1 loc1)
  )
  (:goal (at-pkg pkg1 apt2))
)
