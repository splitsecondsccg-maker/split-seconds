# Character Strategy Audit (Updated)

This audit was re-run after the enabler/payoff card pass.

## Summary
All previously flagged major strategy gaps were addressed with new cards and deck updates.

## Added Enablers / Payoffs by Character
- Rogue: `rogue_shakedown` (hand disruption enabler), `rogue_execution_window` (darkness payoff).
- Mauja: `brute_toxic_slam` (poison enabler), `brute_venom_crush` (poison-threshold payoff).
- Paladin: `paladin_sanctuary` (armor enabler), `paladin_armor_judgment` (armor payoff).
- Vampiress: `vamp_bloodletter_strike` (bleed enabler), `vamp_exsanguinate` (bleed cashout payoff).
- Necromancer: `necro_grave_whisper` (hypnotic enabler), `necro_mind_sever` (consume-hypnotic payoff).
- Palea: `palea_silken_thought` (draw smoothing enabler), `palea_grand_refrain` (high-cost consume payoff).
- Ice Assassin: `ice_assassin_frigid_mark` (freeze enabler), `ice_assassin_shatter_step` (freeze-threshold payoff).
- Ice Brute: `ice_brute_glacial_pummel` (freeze enabler), `ice_brute_shatter_grab` (second freeze-threshold payoff).
- Fae Brute: `fae_brute_trance_hook` (hypnotic enabler), `fae_brute_dreambreaker` (consume-hypnotic payoff).
- Ice Djinn: `ice_djinn_frost_meditation` (resource + freeze enabler), `ice_djinn_absolute_zero` (deep-freeze finisher).

## Negate Cards
Negate cards were upgraded to provide tempo value and not only stall:
- `palea_dont` now draws 1 when negate succeeds.
- `spirit_spirit_form` now applies `FREEZE 1` on each successful negate.
