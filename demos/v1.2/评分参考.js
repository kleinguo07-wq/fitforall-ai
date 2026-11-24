"use strict";

// 依据 DVPRS 的逐分描述改写为原型提示，供用户自评时参考。
const painDescriptions = [
  "一点也不疼。",
  "几乎感觉不到疼。",
  "能感觉到疼，手上的事还能照常做。",
  "疼痛偶尔会让你分心。",
  "疼痛让你分心，但平时做的事还能做。",
  "有些事做到一半，会因为疼而停下来。",
  "很难不去注意疼痛，有些平时做的事会想避开。",
  "大部分注意力都在疼痛上，已经妨碍日常活动。",
  "疼得很厉害，做什么都觉得困难。",
  "疼得几乎受不了，基本做不了别的事。",
  "你能想象到的最疼，几乎没法顾及别的事。"
];

const difficultyDescriptions = [
  "做日常活动一点也不费力。",
  "偶尔觉得有一点点费力。",
  "能感觉到一点费力，做事的速度和平时差不多。",
  "有些动作稍费力，但还能照常做完。",
  "有些事得放慢一点，还是能自己做完。",
  "做一些日常活动时，要停下来歇一歇。",
  "好几项日常活动要分几次才能做完。",
  "多数日常活动都很费力，有些事得少做一点。",
  "有些日常活动得请别人帮忙才能完成。",
  "只能自己做少数简单的事，多数活动需要别人帮忙。",
  "日常活动做不了。"
];

function scoreReferenceText(key, score) {
  const difficulty = key === "difficulty";
  const descriptions = difficulty ? difficultyDescriptions : painDescriptions;
  return score == null
    ? (difficulty ? "点选数字，看看这一分有多费力。" : "点选数字，看看这一分的疼痛感参考。")
    : `${score} 分 · ${descriptions[score]}`;
}
