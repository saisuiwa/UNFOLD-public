// Which settings the 04 見た目 tab shows for the part of the video under the playhead.
// phase: 'chaos' | 'form' | null (null = a picture is simply shown). mode: 'auto' | 'all'.
export function lookView(mode, phase) {
  if (mode === 'all') return 'all';
  return phase === 'chaos' || phase === 'form' ? phase : 'image';
}

const NAMES = { chaos: 'ぐちゃぐちゃ', form: '立体化', image: '画像' };

export function lookViewText(view) {
  if (view === 'all') return { label: 'すべての設定を表示中', hint: '' };
  return { label: `いま：${NAMES[view]}`, hint: view === 'image' ? '◆の区間にプレイヘッドを動かすと、変形の設定が出るよ' : '' };
}
