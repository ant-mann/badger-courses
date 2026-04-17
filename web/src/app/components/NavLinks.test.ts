import assert from "node:assert/strict";
import test from "node:test";

import * as navLinks from "./NavLinks";

test("NavLinks marks Course Explorer active for course detail routes", () => {
  assert.equal(typeof navLinks.isNavItemActive, "function");
  assert.equal(navLinks.isNavItemActive?.("/courses", "/courses"), true);
  assert.equal(navLinks.isNavItemActive?.("/", "/courses/COMP%20SCI%20577"), false);
  assert.equal(navLinks.isNavItemActive?.("/courses", "/courses/COMP%20SCI%20577"), true);
});

test("NavLinks marks Schedule Builder active for the home route", () => {
  assert.equal(typeof navLinks.isNavItemActive, "function");
  assert.equal(navLinks.isNavItemActive?.("/", "/"), true);
  assert.equal(navLinks.isNavItemActive?.("/courses", "/"), false);
});

test("NavLinks does not mark Schedule Builder active for prefix collisions", () => {
  assert.equal(typeof navLinks.isNavItemActive, "function");
  assert.equal(navLinks.isNavItemActive?.("/", "/courses"), false);
  assert.equal(navLinks.isNavItemActive?.("/courses", "/courses-archive"), false);
  assert.equal(navLinks.isNavItemActive?.("/courses", "/courses/archive"), true);
});
