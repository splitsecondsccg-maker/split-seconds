// tests.js
// Tiny, dependency-free sanity tests you can run from the browser console.
// Usage:
//   SplitSecondsTest.run();

(function () {
  "use strict";

  function deepClone(x) {
    return JSON.parse(JSON.stringify(x));
  }

  function assert(cond, msg) {
    if (!cond) throw new Error("TEST FAILED: " + msg);
  }

  function makeMinimalState() {
    const p = classData["Rogue"];
    const a = classData["Mauja"];
    const s = {
      player: {
        class: "Rogue",
        hp: p.maxHp || 40,
        maxHp: p.maxHp || 40,
        stam: p.maxStam,
        maxStam: p.maxStam,
        armor: p.armor,
        deck: (typeof buildDeckFromDeckId==='function' ? buildDeckFromDeckId(getDefaultDeckIdForCharacter('Rogue')) : buildDeck(p.deck)),
        hand: [],
        timeline: [null, null, null, null, null],
        statuses: getBaseStatuses(),
        roundData: { lostLife: false, appliedStatus: false },
      },
      ai: {
        class: "Mauja",
        hp: a.maxHp || 40,
        maxHp: a.maxHp || 40,
        stam: a.maxStam,
        maxStam: a.maxStam,
        armor: a.armor,
        deck: (typeof buildDeckFromDeckId==='function' ? buildDeckFromDeckId(getDefaultDeckIdForCharacter('Mauja')) : buildDeck(a.deck)),
        hand: [],
        timeline: [null, null, null, null, null],
        statuses: getBaseStatuses(),
        roundData: { lostLife: false, appliedStatus: false },
      },
      phase: "planning",
      currentMoment: 0,
      useDeterministicRng: true,
      rngSeed: 123,
      pivotSlots: [0, 1, 2, 3, 4],
    };
    return s;
  }

  function testPlaceCard() {
    const s = makeMinimalState();
    s.player.hand.push({ ...s.player.deck[0], uniqueId: "t0" });

    const beforeStam = s.player.stam;
    const res = EngineRuntime.step(s, {
      type: EngineRuntime.ActionTypes.PLACE_CARD_FROM_HAND,
      payload: { handIndex: 0, startMoment: 0 },
      meta: { alertOnError: false },
    });
    assert(res.ok !== false, "place should succeed");
    assert(s.player.hand.length === 0, "hand should decrease");
    assert(s.player.timeline[0] !== null, "timeline slot 1 should be occupied");
    assert(s.player.stam <= beforeStam, "stamina should decrease");
  }

  function testConfirmExert() {
    const s = makeMinimalState();
    s.phase = "exert";
    s.player.hand = [
      { ...s.player.deck[0], uniqueId: "e0", selectedForExert: true },
      { ...s.player.deck[1], uniqueId: "e1", selectedForExert: false },
    ];

    const beforeHand = s.player.hand.length;
    const beforeStam = s.player.stam;

    const res = EngineRuntime.step(s, {
      type: EngineRuntime.ActionTypes.CONFIRM_EXERT,
      payload: {},
      meta: { alertOnError: false },
    });
    assert(res.ok !== false, "confirm exert should succeed");
    assert(s.phase === "planning", "phase should return to planning");
    assert(s.player.hand.length >= beforeHand - 1, "burned card removed then draws happen");
    assert(s.player.stam >= beforeStam, "stamina should not go down");
  }

  function run() {
    const results = [];
    const cases = [
      ["place card", testPlaceCard],
      ["confirm exert", testConfirmExert],
    ];
    for (const [name, fn] of cases) {
      try {
        fn();
        results.push({ name, ok: true });
      } catch (e) {
        results.push({ name, ok: false, error: e.message });
      }
    }
    console.table(results);
    const failed = results.filter((r) => !r.ok);
    if (failed.length) throw new Error("Some tests failed");
    return results;
  }

  window.SplitSecondsTest = {
    run,
    makeMinimalState,
    deepClone,
  };
})();
