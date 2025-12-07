(define (problem bw-example-2)
  (:domain blocks-world)

  (:objects
    a b c d - block
  )

  (:init
    ;; Initial configuration:
    ;;    c
    ;;    |
    ;;    b
    ;;    |
    ;;    a      d
    ;;  ----------- (table)
    (ontable a)
    (ontable d)
    (on b a)
    (on c b)

    ;; Clear blocks
    (clear c)
    (clear d)

    ;; Hand initially empty
    (handempty)
  )

  ;; Goal configuration:
  ;;      c
  ;;      |
  ;;      b
  ;;      |
  ;;      a
  ;;      |
  ;;      d
  ;;  ----------- (table)
  (:goal
    (and
      (ontable d)
      (on a d)
      (on b a)
      (on c b)
      (clear c)
    )
  )
)