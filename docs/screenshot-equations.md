# Screenshot equation verification

Reviewed all 25 PNGs in the local `examples/` folder, in filename order. Every formula is supported. The transcriptions below use `floor(...)` for floor brackets and `abs(...)` for absolute-value bars. They are editable expressions accepted by the homepage and both Studio views.

`triangle(t) = 4 * abs(t - floor(t + 3/4) + 1/4) - 1`. This exact abbreviation keeps the most deeply nested examples readable and within the existing expression limits. `arctan(t)` is an alias for `atan(t)`. No arbitrary evaluation or larger safety budgets are needed.

Random contains all 25 reference families alongside the previous 32, with faithful formulas and time shifts/stretches. Its category/family shuffle prevents immediate repeats and visits every family within its category before repeating. The two negative-only notes are translated to a repeating positive-time window for Random; the original remains below.

The homepage automatically extends its frame for explicit numeric bounds outside [-4, 4], up to [-64, 64]. To hear the original negative-only notes, click their part of the graph before Play. For asymptotes, extreme tails are clipped to a useful view; the equation itself is unchanged. Undefined values remain gaps and silence. Existing pitch limits still apply to sound.

Verification checks compilation, KaTeX rendering, negative/positive domains, bound edges, modulo pulse widths, raw continuous music values, Random coverage/parameter variants, and browser rendering. Dense folds are sampled on a non-aligned grid so their structure cannot alias to zero. Expanded floor/abs forms are compared numerically with the compact helper.

## 01. Two bounded notes

Source: `Screenshot 2026-10-04 000224.png`

Verified supported.

```text
{ 0.5 if -7.5776 <= x < -7.2207; 0.25 if -7.2207 <= x < -6.9518 }
```

The original exists only at negative x. Random translates it to x = 0 and repeats every two beats, preserving both note lengths and the rest.

Random version:

```text
{ 0.5 if x mod 2 < 0.3569; 0.25 if 0.3569 <= x mod 2 < 0.6258 }
```

## 02. Four decay branches

Source: `Screenshot 2026-10-04 000241.png`

Verified supported.

```text
{ -2.34 + 1.88 * exp(-7.69 * (x mod 4)) + 0.938 * sin(31.4 * (x mod 4)) if x mod 4 < 0.5; 1.98 + 1.25 * exp(-25 * ((x + 2) mod 8)) if (x + 2) mod 8 < 0.25; -4 + 2.28 * exp(-5.56 * ((x + 6) mod 8)) if (x + 6) mod 8 < 0.75; -5 + 2.5 * exp(-4.35 * (x mod 2)) if x mod 2 < 2 }
```

## 03. Chirped piecewise blend

Source: `Screenshot 2026-10-04 000256.png`

Verified supported.

```text
{ sin(pi * ((x + 16) mod 32) / 5) * (1 - 2 * (((((x + 16) mod 32) - 10) * ((x + 16) mod 32) / 7) mod 1)) if (x + 16) mod 32 < 15; (1 - min(1, (x + 1) / 8)) * sin(pi * x + 0.9 * sin(pi * x / 2)) + min(1, (x + 1) / 8) * (0.5 - 3 * sin(pi * ((x * sin(x) / 8) mod 1) / x)) otherwise }
```

Undefined at x = 0 in the otherwise branch; that point is a gap.

## 04. Three bounded decays

Source: `Screenshot 2026-10-04 000308.png`

Verified supported.

```text
{ 1.08 - 2.5 * exp(-((x + 1) mod 2) / 0.02) if (x + 1) mod 2 < 0.125; -4.42 + 3.25 * exp(-(x mod 2) / 0.225) + 1.04 * sin(31.4 * (x mod 2)) if x mod 2 < 1; -4.42 + 3.25 * exp(-((x + 0.5) mod 16) / 0.225) + 1.04 * sin(31.4 * ((x + 0.5) mod 16)) if (x + 0.5) mod 16 < 0.5 }
```

## 05. Growing folded spikes

Source: `Screenshot 2026-10-04 000349.png`

Verified supported.

```text
0.5 * x * triangle(x)^2 * triangle(x * triangle(x))^2
```

triangle(t) exactly abbreviates 4*abs(t-floor(t+3/4)+1/4)-1.

## 06. Stepped hyperbolic bends

Source: `Screenshot 2026-10-04 000401.png`

Verified supported.

```text
floor(2 * triangle(x) + 2) + arctan(sinh(6 * (((2 * triangle(x / 16) + 2) mod 1)) - 3)) / (2 * arctan(sinh(3))) - 1.5
```

## 07. Three rounded arches

Source: `Screenshot 2026-10-04 000413.png`

Verified supported.

```text
1.25 * sqrt(max(0, 1 - 6.25 * (x mod 3 - 0.58)^2)) + 3.85 * sqrt(max(0, 1 - 5.41 * (x mod 3 - 1.5)^2)) + 1.25 * sqrt(max(0, 1 - 6.25 * (x mod 3 - 2.42)^2)) - 4
```

## 08. Sparse decay fills

Source: `Screenshot 2026-10-04 000423.png`

Verified supported.

```text
{ -2.34 + 1.88 * exp(-15.4 * ((x + 8) mod 16)) + 0.938 * sin(31.4 * ((x + 8) mod 16)) if (x + 8) mod 16 < 0.25; 1.98 + 1.25 * exp(-50 * ((x + 1) mod 2)) if (x + 1) mod 2 < 0.125; 1.98 + 1.25 * exp(-50 * ((x + 0.5) mod 8)) if (x + 0.5) mod 8 < 0.125; -4.69 + 2.5 * exp(-8.7 * (x mod 2)) if x mod 2 < 1 }
```

## 09. Sawtooth section changes

Source: `Screenshot 2026-10-04 000439.png`

Verified supported.

```text
{ 2.5 - 5 * (5 * x mod 1) if floor(x) mod 16 == 0; 2.3 - 4.6 * (x mod 1) if (-2 <= x < 0) or (14 <= x < 16); 2.3 - 4.6 * (x / 2 mod 1) otherwise }
```

## 10. Sine ratio asymptotes

Source: `Screenshot 2026-10-04 000450.png`

Verified supported.

```text
1.2 * sin(x / 2) / sin(1.2 * x)
```

Poles are clipped by the view; undefined values are silent.

## 11. Double-folded harmonic peaks

Source: `Screenshot 2026-10-04 000505.png`

Verified supported.

```text
4.8 * (1 - abs(2 * (1 - abs(2 * (0.5 + 0.16 * (1 - 2 * abs(2 * ((x / 8) mod 1) - 1)) + 0.12 * (1 - 2 * abs(2 * ((3 * x / 8) mod 1) - 1)) + 0.09 * (1 - 2 * abs(2 * ((5 * x / 8) mod 1) - 1)) + 0.07 * (1 - 2 * abs(2 * ((7 * x / 8) mod 1) - 1)) + 0.05 * (1 - 2 * abs(2 * ((11 * x / 8) mod 1) - 1))) - 1)) - 1)) - 2.4
```

## 12. Hyperbolic sine packet

Source: `Screenshot 2026-10-04 000518.png`

Verified supported.

```text
sin(6 * x) / cosh(x / 2)
```

## 13. Triangle harmonics and steps

Source: `Screenshot 2026-10-04 000537.png`

Verified supported.

```text
0.85 * (1 - 2 * abs(2 * ((x / 8) mod 1) - 1)) + 0.6 * (1 - 2 * abs(2 * ((3 * x / 8) mod 1) - 1)) + 0.4 * (1 - 2 * abs(2 * ((5 * x / 8) mod 1) - 1)) + 0.26 * (1 - 2 * abs(2 * ((7 * x / 8) mod 1) - 1)) + 0.4 * (floor(6 * (x / 8 mod 1)) - 2.5)
```

## 14. Three-against-five triangles

Source: `Screenshot 2026-10-04 000550.png`

Verified supported.

```text
1.4 * (1 - 2 * abs(2 * ((x / 3) mod 1) - 1)) + (1 - 2 * abs(2 * ((x / 5) mod 1) - 1))
```

## 15. Stepped decay arches

Source: `Screenshot 2026-10-04 000625.png`

Verified supported.

```text
3.2 * exp(-0.5 * floor(x mod 4)) * (1 - (2 * (x mod 1) - 1)^2) - 1.6
```

## 16. Decay with fast ripples

Source: `Screenshot 2026-10-04 000637.png`

Verified supported.

```text
6 * exp(-3 * (x mod 4)) - 3 + 0.4 * sin(20 * (x mod 6))
```

## 17. Pulse, hold and ramp

Source: `Screenshot 2026-10-04 000653.png`

Verified supported.

```text
{ 3 * (1 - 2 * floor(2 * (6 * x mod 1))) if x mod 2 < 0.5; -1.2 if x mod 2 < 1.2; 2.2 * 2 * (2 * x - floor(2 * x + 0.5)) otherwise }
```

## 18. Root and rational branches

Source: `Screenshot 2026-10-04 000809.png`

Verified supported.

```text
{ sqrt(abs(x)) / 2 - 1 if x mod 4 < 2; (x^2 + 1) / (3 * x) otherwise }
```

## 19. Nested sine modulation

Source: `Screenshot 2026-10-04 000819.png`

Verified supported.

```text
2.8 * sin(5 * sin(4 * sin(3 * sin(2 * sin(x)))))
```

## 20. Descending stepped fills

Source: `Screenshot 2026-10-04 000836.png`

Verified supported.

```text
{ 1.73 * floor(1.5 * (x mod 2)) - 2.3 * (x mod 2) if x mod 16 < 2; 0.6 - 2 * (x mod 2) otherwise }
```

## 21. Reciprocal

Source: `Screenshot 2026-10-04 000848.png`

Verified supported.

```text
1 / x
```

x = 0 is undefined. The asymptote is clipped rather than flattening the rest of the graph.

## 22. Changing pulse widths

Source: `Screenshot 2026-10-04 000859.png`

Verified supported.

```text
3 * (1 - min(1, floor((x mod 1) / (0.15 + 0.25 * (floor(x) mod 3))))) - 1.5
```

## 23. Rectified decay melody

Source: `Screenshot 2026-10-04 000909.png`

Verified supported.

```text
5 * exp(-(x mod 4)) * abs(sin(2.2 * (x mod 5))) - 2
```

## 24. Pulse accents and saw fills

Source: `Screenshot 2026-10-04 000920.png`

Verified supported.

```text
{ 2.6 * (1 - 2 * floor(2 * (9 * x mod 1))) if floor(x) mod 16 == 0; 1.7 * 2 * (4 * x - floor(4 * x + 0.5)) if floor(x) mod 4 == 0; 0.9 - 1.8 * frac(x) otherwise }
```

## 25. Dense nested triangle folds

Source: `Screenshot 2026-10-04 000930.png`

Verified supported.

```text
2.7 * triangle(3 * triangle(2 * triangle(x)))
```

The compact triangle helper is algebraically identical to the repeated floor/abs formula.
