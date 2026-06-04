import DiffMatchPatch from 'diff-match-patch';

const dmp = new DiffMatchPatch();

export const computeLineDiff = (oldText, newText) => {
  const { chars1, chars2, lineArray } = dmp.diff_linesToChars_(oldText, newText);
  const diffs = dmp.diff_main(chars1, chars2, false);
  dmp.diff_charsToLines_(diffs, lineArray);

  const result = [];
  for (const [op, text] of diffs) {
    const lines = text.split('\n').filter(l => l !== '');
    for (const line of lines) {
      result.push({
        type: op === 1 ? 'added' : op === -1 ? 'removed' : 'unchanged',
        content: line,
      });
    }
  }
  return result;
};
