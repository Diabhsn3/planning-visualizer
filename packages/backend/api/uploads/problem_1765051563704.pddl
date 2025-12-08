(define (problem bw-example-1)
  (:domain blocks-world)

  (:objects
    a b c - block
  )

  (:init
    (ontable a)
    (ontable b)
    (on c a)
    (clear c)
    (clear b)
    (handempty)
  )

  (:goal
    (and
      (ontable a)
      (on b a)
      (on c b)
      (clear c)
    )
  )
)