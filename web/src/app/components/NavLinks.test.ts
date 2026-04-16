import assert from "node:assert/strict";
import test from "node:test";

import * as navLinks from "./NavLinks";

test("NavLinks marks Course Explorer active for course detail routes", () => {
  assert.equal(typeof navLinks.isNavItemActive, "function");
  assert.equal(navLinks.isNavItemActive?.("/", "/courses/COMP%20SCI%20577"), true);
  assert.equal(navLinks.isNavItemActive?.("/schedule-builder", "/courses/COMP%20SCI%20577"), false);
});

test("NavLinks marks Schedule Builder active for schedule-builder routes", () => {
  assert.equal(typeof navLinks.isNavItemActive, "function");
  assert.equal(navLinks.isNavItemActive?.("/schedule-builder", "/schedule-builder"), true);
  assert.equal(navLinks.isNavItemActive?.("/", "/schedule-builder"), false);
});
