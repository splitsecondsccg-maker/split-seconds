# Balance Matrix V2 (Strict Cost/Payoff)

Date: 2026-03-09

## 1) Core Metric

We use an **Equivalent Damage Budget (EDB)** for balance checks:

- `EDB = direct_damage + status_value + resource_value + disruption_value`
- `Efficiency = EDB / (stamina_cost + moments)`

This is used for tuning targets, not for exact in-game resolution.

## 2) Effect Value Weights (EDB)
### Status Persistence Adjustment

For persistent damage statuses we use expected-turn value (not just immediate face damage):

- `BLEED 1` assumes one future attack-hit detonation opportunity in short horizon, so baseline remains +0.75 EDB.
- `POISON 1` assumes at least one end-turn tick plus partial decay value carry, so baseline remains +0.65 EDB.
- On cards that repeatedly apply status across multiple moments (`resolveEachMoment`), status value is counted per successful moment-hit.

- `+1 draw` = +1.5 EDB
- `opponent draw -1 next turn` = +1.5 EDB
- `+1 stamina swing` (gain/steal/exhaust) = +1.25 EDB
- `BLEED 1` = +0.75 EDB
- `POISON 1` = +0.65 EDB
- `FREEZE 1` = +0.55 EDB
- `HYPNOTIZED apply` = +1.0 EDB
- `hard negate action` = +2.5 EDB baseline
- `next attack +1 dmg` = +0.9 EDB

## 3) Strict Target Bands

For non-ability cards:

- **Attack**: `0.90 - 1.20` efficiency
- **Grab**: `0.95 - 1.30` efficiency
- **Buff/Utility/Enhancer**: `0.75 - 1.15` efficiency
- **Multi-moment resolve_each_moment attacks**: `0.80 - 1.10` after counting per-moment status applications

Proficiency modifiers (upper edge allowances):

- **Assassin, Brute**: up to +0.10 for damage-centric lines
- **Vampire, Fae, Darkness**: up to +0.10 only if conditional/interactive risk exists
- **Ice, Poison, Bleed, Hypnotic**: stay near center band unless gated by strict requirements

## 4) Pass 2 Applied Tuning

### Nerfs (outliers above strict band)

- `rogue_quick_jab`: dmg `2 -> 1`
- `rogue_kidney_strike`: dmg `3 -> 2`
- `brute_suplex`: dmg `6 -> 5`
- `brute_dev_blow`: dmg `9 -> 8`
- `paladin_holy_smite`: dmg `7 -> 6`
- `vamp_claw_swipe`: dmg `2 -> 1`
- `vamp_lethal_embrace`: dmg `7 -> 6`
- `necro_skull_blast`: dmg `4 -> 3`
- `necro_necro_blast`: dmg `8 -> 7`

### Buffs (under strict floor)

- `brute_sunder`: dmg `2 -> 3`
- `poison_toxic_sting`: dmg `1 -> 2`
- `bleed_open_wound`: dmg `1 -> 2`

## 5) Notes

- Character abilities were excluded from this pass.
- `double_slice` and `spiders_swarm` are treated with the multi-moment rule and were kept as identity-defining cards.
- Next pass should be simulation-backed (Hard vs Pro, mirror and cross-deck matchups, 1k+ rounds each).


## 6) Effect-Aware Pass (2026-03-09)

Applied extra constraints:
- Status effects (BLEED/POISON/FREEZE/HYPNOTIZED/EXHAUSTED) are priced as expected-value, not free add-ons to raw DMG.
- Grabs carry execution risk, so at equal cost+moments they are tuned to slightly higher payoff than comparable attacks.
- Conditional/consume-status cards keep higher ceilings (status setup + payoff pattern).
- Proficiency-native cards are allowed a small edge within their lane, while keeping cross-lane parity.

Retuned cards in this pass:
- 
ecro_plague_grip: 2 DMG + POISON 2 -> 3 DMG + POISON 3 (grab risk + poison lane payoff).
- ampire_blood_sip: 2 DMG + heal 1 -> 3 DMG + heal 1 (grab version now better than attack sibling).
- 
ecro_chiller: 2 DMG -> 3 DMG (grab risk + control rider).
- poison_toxic_sting: kept as low raw (1 DMG) with status rider to avoid overloading attack baseline.
- leed_open_wound: kept as low raw (1 DMG) with status rider to preserve status-for-damage tradeoff.

Bug fixes found during audit:
- siphon_soul now triggers on successful grab-hit too.
- chiller now triggers on successful grab-hit too.
- Added missing draw_blood effect handler.
- Parry draw-penalty now stacks per successful parry event (important for multi-moment interactions).

