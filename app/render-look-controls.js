import { cleanRenderLook } from './render-look.js?v=2';
export function createRenderControls({ value, onChange, onApply = null, preview = false } = {}) {
  let state = cleanRenderLook(value);
  const box = document.createElement('details'); box.className = 'render-look-controls';
  const summary = document.createElement('summary'); summary.textContent = '表示比較：カメラ・光・半透明'; box.append(summary);
  const controls = {};
  const emit = () => { state = cleanRenderLook(state); onChange?.({ ...state }); };
  const check = (key, title) => {
    const label = document.createElement('label'), input = document.createElement('input');input.type = 'checkbox';input.dataset.look = key;input.checked = state[key];
    input.onchange = () => { state[key] = input.checked; emit(); };label.append(input, title);box.append(label);controls[key] = input;
  };
  check('enabled', ' 調整した表示を使う（OFFで元の表示）');
  const slider = (key, title, min, max, step) => {
    const label = document.createElement('label'), cap = document.createElement('span'), out = document.createElement('output'), input = document.createElement('input');
    cap.textContent = title;input.type = 'range';input.min = min;input.max = max;input.step = step;input.value = state[key];input.dataset.look = key;input.setAttribute('aria-label', title);out.textContent = state[key];
    input.oninput = () => { state[key] = Number(input.value);out.textContent = input.value;emit(); };label.append(cap, out, input);box.append(label);controls[key] = input;controls[key+'Output'] = out;
  };
  slider('perspective', '遠近感', 0, 1, .05);
  check('lighting', ' 光と陰影を調整');
  slider('azimuth', '光の左右（度）', -180, 180, 5);slider('elevation', '光の上下（度）', -80, 80, 5);slider('shade', '陰影の強さ', 0, 1, .05);
  const label = document.createElement('label');label.append('半透明 ');
  const alpha = document.createElement('select');alpha.dataset.look = 'alpha';alpha.setAttribute('aria-label','半透明の方式');
  for (const [value, text] of [['original','元の方式'],['dither','網点で重ねる（実験）']]) { const o = document.createElement('option');o.value=value;o.textContent=text;alpha.append(o); }
  alpha.value=state.alpha;alpha.onchange=()=>{state.alpha=alpha.value;emit()};label.append(alpha);box.append(label);controls.alpha=alpha;
  const note = document.createElement('p');note.textContent = '網点方式は重なりの欠けを抑える比較用です。粒状感が出ます。元画像の区間には適用しません。';box.append(note);
  const scope = document.createElement('p');scope.textContent = preview ? 'ここはプレビューの比較設定です。コードのコピーには入りません。' : 'この設定は画面と動画書き出しに反映されます。ONではこちらの遠近感を使い、OFFで元のカメラ設定に戻ります。';box.append(scope);
  if(onApply){const b=document.createElement('button');b.type='button';b.textContent='この表示設定を本体にも適用';b.onclick=()=>onApply({...state});box.append(b);}
  const reset=document.createElement('button');reset.type='button';reset.textContent='比較設定を初期値に戻す';reset.onclick=()=>{setValue();emit()};box.append(reset);
  function setValue(value) { state=cleanRenderLook(value);for(const key of ['enabled','lighting'])controls[key].checked=state[key];for(const key of ['perspective','azimuth','elevation','shade','alpha']){controls[key].value=state[key];if(controls[key+'Output'])controls[key+'Output'].textContent=state[key]} }
  return {element:box, setValue, get value(){return {...state}}};
}
