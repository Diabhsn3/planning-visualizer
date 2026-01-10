(define (problem depot-demo)
  (:domain depot)

  (:objects
      d1 d2 - depot
      t1 - truck
      c1 c2 - crane
      p1 p2 - package
      pile1 pile2 - pile
  )

  (:init
      ;; truck starts at d1
      (at-truck t1 d1)

      ;; cranes at their depots
      (at-crane c1 d1)
      (empty-crane c1)
      (at-crane c2 d2)
      (empty-crane c2)

      ;; pile locations - pile1 at d1, pile2 at d2
      (at-pile pile1 d1)
      (at-pile pile2 d2)

      ;; packages stacked: p1 on top of p2, p2 on pile1
      (on p2 pile1)       ;; p2 is on pile1 (using unified 'on' predicate)
      (on p1 p2)          ;; p1 is on p2
      (clear p1)          ;; p1 is on top, nothing above it
      (clear pile2)       ;; pile2 is empty
      ;; Note: pile1 is NOT clear because p2 is on it
      ;; Note: p2 is NOT clear because p1 is on it
  )

  ;; Goal: move p2 to pile2 at d2
  (:goal
      (on p2 pile2)
  )
)
