(define (domain satellite)
  (:requirements :typing :strips :negative-preconditions)
  
  (:types
      satellite instrument target direction groundstation image
  )

  (:predicates
      ;; Satellite orientation
      (pointing ?s - satellite ?d - direction)

      ;; Instrument properties
      (onboard ?i - instrument ?s - satellite)
      (supports ?i - instrument ?t - target)
      (calibrated ?i - instrument)
      (calibration-target ?i - instrument ?t - target)

      ;; Imaging
      (have-image ?t - target)
      (image-taken ?i - instrument ?t - target)

      ;; Resources
      (power-avail ?s - satellite)
      (storage-avail ?s - satellite)

      ;; Communication
      (visible ?s - satellite ?g - groundstation)
  )

  ;; Turn satellite
  (:action turn
     :parameters (?s - satellite ?d1 - direction ?d2 - direction)
     :precondition (and (pointing ?s ?d1) (power-avail ?s))
     :effect (and
        (not (pointing ?s ?d1))
        (pointing ?s ?d2))
  )

  ;; Calibrate instrument
  (:action calibrate
     :parameters (?s - satellite ?i - instrument ?t - target ?d - direction)
     :precondition (and
        (onboard ?i ?s)
        (calibration-target ?i ?t)
        (pointing ?s ?d)
        (power-avail ?s))
     :effect (calibrated ?i)
  )

  ;; Take image
  (:action take-image
     :parameters (?s - satellite ?i - instrument ?t - target ?d - direction)
     :precondition (and
        (onboard ?i ?s)
        (supports ?i ?t)
        (calibrated ?i)
        (pointing ?s ?d)
        (storage-avail ?s)
        (power-avail ?s))
     :effect (and
        (image-taken ?i ?t)
        (not (storage-avail ?s)))
  )

  ;; Transmit image
  (:action transmit-image
     :parameters (?s - satellite ?i - instrument ?t - target ?g - groundstation)
     :precondition (and
        (image-taken ?i ?t)
        (visible ?s ?g)
        (power-avail ?s))
     :effect (and
        (have-image ?t)
        (storage-avail ?s))
  )
)