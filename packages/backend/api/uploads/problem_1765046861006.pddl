(define (problem bw-1)
  (:domain blocks-world)

  (:objects
    a b c - block
  )

  (:init
    (ontable a)
    (ontable b)
    (ontable c)
    (clear a)
    (clear b)
    (clear c)
    (handempty)
  )

  (:goal (and
    (on a b)
    (on b c)
  ))
)

