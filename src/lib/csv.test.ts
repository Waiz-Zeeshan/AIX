import { describe, expect, it } from "vitest";
import { CsvParseError, parseCsv } from "./csv";

describe("parseCsv", () => {
  it("parses a simple LF-terminated CSV", () => {
    const input = "email,name,role\nfoo@x.com,Foo,AGENT\nbar@x.com,Bar,ORCH\n";
    expect(parseCsv(input)).toEqual([
      ["email", "name", "role"],
      ["foo@x.com", "Foo", "AGENT"],
      ["bar@x.com", "Bar", "ORCH"]
    ]);
  });

  it("parses CRLF line endings", () => {
    const input = "a,b\r\n1,2\r\n3,4\r\n";
    expect(parseCsv(input)).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"]
    ]);
  });

  it("handles input with no trailing newline", () => {
    const input = "a,b\n1,2";
    expect(parseCsv(input)).toEqual([
      ["a", "b"],
      ["1", "2"]
    ]);
  });

  it("strips a UTF-8 BOM", () => {
    const input = "﻿email,name\nfoo@x.com,Foo\n";
    const rows = parseCsv(input);
    expect(rows[0]).toEqual(["email", "name"]);
  });

  it("parses quoted fields containing commas", () => {
    const input = 'a,b,c\n"x,y","hello, world",z\n';
    expect(parseCsv(input)).toEqual([
      ["a", "b", "c"],
      ["x,y", "hello, world", "z"]
    ]);
  });

  it('handles escaped double-quotes ("") inside a quoted field', () => {
    const input = 'a,b\n"she said ""hi""",ok\n';
    expect(parseCsv(input)).toEqual([
      ["a", "b"],
      ['she said "hi"', "ok"]
    ]);
  });

  it("supports newlines inside quoted fields", () => {
    const input = 'a,b\n"line1\nline2",ok\n';
    expect(parseCsv(input)).toEqual([
      ["a", "b"],
      ["line1\nline2", "ok"]
    ]);
  });

  it("skips fully blank lines", () => {
    const input = "a,b\n\n1,2\n\n";
    expect(parseCsv(input)).toEqual([
      ["a", "b"],
      ["1", "2"]
    ]);
  });

  it("treats blank role as an empty field, not a missing column", () => {
    const input = "email,name,role\nfoo@x.com,Foo,\n";
    expect(parseCsv(input)).toEqual([
      ["email", "name", "role"],
      ["foo@x.com", "Foo", ""]
    ]);
  });

  it("throws CsvParseError on an unterminated quoted field", () => {
    const input = 'a,b\n"oops,never closes\n';
    expect(() => parseCsv(input)).toThrow(CsvParseError);
  });
});
