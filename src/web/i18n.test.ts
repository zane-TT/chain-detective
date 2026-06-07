import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getEventFilterCopy,
  getLiquidityCopy,
  getWatchFormCopy,
  resolveLocale,
} from "./i18n.js";

test("resolves browser locale strings into supported locales", () => {
  assert.equal(resolveLocale("zh-CN"), "zh");
  assert.equal(resolveLocale("en-US"), "en");
  assert.equal(resolveLocale("fr-FR"), "en");
  assert.equal(resolveLocale(undefined), "en");
});

test("provides localized dashboard interaction copy", () => {
  const watchCopy = getWatchFormCopy("zh");
  const liquidityCopy = getLiquidityCopy("zh");
  const eventFilterCopy = getEventFilterCopy("zh");

  assert.equal(watchCopy.submit, "加入监控");
  assert.equal(watchCopy.copyError, "无法复制地址。");
  assert.equal(liquidityCopy.statusDegraded, "部分完成");
  assert.equal(eventFilterCopy.empty, "当前筛选条件下没有匹配事件。");
});
