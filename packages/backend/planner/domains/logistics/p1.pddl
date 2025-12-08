(define (problem logistics-p1)
  (:domain logistics)

  (:objects
      pkg1 - package
      truck1 - truck
      plane1 - airplane
      cA cB - city
      aA aB - airport
  )

  (:init
      ;; packages
      (at pkg1 cA)

      ;; truck at cA
      (at-truck truck1 cA)

      ;; plane at airport aA
      (at-plane plane1 aA)
  )

  (:goal
      (and (at pkg1 cB))
  )
)
