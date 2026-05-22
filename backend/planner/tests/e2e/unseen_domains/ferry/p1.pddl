(define (problem ferry-p1)
  (:domain ferry)
  (:objects
    car1 car2 - car
    side-a side-b - location
  )
  (:init
    (at-ferry side-a)
    (at car1 side-a)
    (at car2 side-a)
    (empty-ferry)
  )
  (:goal (and (at car1 side-b) (at car2 side-b)))
)
