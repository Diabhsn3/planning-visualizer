(define (problem bw-example-4)
  (:domain blocks-world)

  (:objects
    a b c d - block
  )

  (:init
    ;; Initial configuration:
    ;;      d
    ;;      |
    ;;      c      b      a
    ;;  ----------------------
    (ontable c)
    (on d c)

    (ontable b)
    (ontable a)

    (clear d)
    (clear b)
    (clear a)
    (handempty)
  )

  ;; Goal configuration:
  ;;      c
  ;;      |
  ;;      b
  ;;      |
  ;;      a      d
  ;;  ----------------------
  (:goal
    (and
      (ontable a)
      (on b a)
      (on c b)
      (ontable d)
      (clear c)
      (clear d)
    )
  )
)