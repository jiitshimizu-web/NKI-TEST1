/* GitHub Pages用追加処理。既存jsファイルは変更せず、このファイルで接続部分を切り替えます。 */
let remoteActive=false, remoteStarting=false, savedAnswer=null;
const answerStorageKey='remote-exam-answer:'+location.pathname;
esc=function(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');};
function csvCell(v){return '"'+String(v??'').replace(/"/g,'""')+'"';}
function safeName(s){return String(s).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,80);}
loadQuestions=function(text){
 const raw=parseCSV(text);
 if(!raw.length||!raw.some(q=>q.id&&q.question))throw new Error('問題データが空か、形式が正しくありません。');
 mergedQuestions=buildQuestionBlocks(raw);render();
 document.getElementById('loadedExamInfo').textContent='読込済み：'+loadedExamFile;
};
async function getExamText(file){
 if(location.protocol==='file:'){
  if(window.EXAM_BUNDLED_DATA[file]===undefined)throw new Error('収録されていない問題です。');
  return window.EXAM_BUNDLED_DATA[file];
 }
 const res=await fetch('data/'+encodeURIComponent(file),{cache:'no-store'});
 if(!res.ok)throw new Error('問題ファイルの読み込みに失敗しました：'+file);
 return res.text();
}
loadExamByCode=async function(code){
 try{
  const row=parseCSV(await getExamText('exam_map.csv')).find(r=>(r['試験コード']||'').trim()===code);
  if(!row)throw new Error('試験コードが存在しません。先生から案内されたコードを入力してください。');
  loadedExamFile=(row['試験問題']||'').trim();
  loadQuestions(await getExamText(loadedExamFile));return true;
 }catch(e){alert(e.message);return false;}
};
startExam=async function(){
 if(remoteStarting||remoteActive||examEnded)return;
 studentId=document.getElementById('studentId').value.trim();studentName=document.getElementById('studentName').value.trim();examCode=document.getElementById('examCode').value.trim();
 if(!studentId||!studentName||!examCode){alert('受験番号・名前・試験コードを入力してください。');return;}
 remoteStarting=true;
 const button=document.querySelector('#startScreen button');button.disabled=true;
 const ok=await loadExamByCode(examCode);
 remoteStarting=false;button.disabled=false;if(!ok)return;
 leaveCount=0;warningCount=0;eventLogs=[];remoteActive=true;startTime=now();
 document.getElementById('startScreen').style.display='none';document.getElementById('main').style.display='flex';
 document.getElementById('userInfo').textContent=`受験番号：${studentId} / 名前：${studentName} / 試験コード：${examCode}`;
 logEvent('START_EXAM','code='+examCode);startTimer();
};
collectAnswers=function(){
 const rows=[];let i=0;const f=document.getElementById('examForm');
 const add=q=>{
  const control=f.elements.namedItem('q'+i);
  const value=(q.type||'').toLowerCase()==='normal'?'':(control?.value||'');
  rows.push([i+1,q.id||'',value].map(csvCell).join(','));i++;
 };
 mergedQuestions.forEach(b=>b.type==='single'?add(b.data):b.data.children.forEach(add));
 return rows.join('\r\n');
};
function downloadAnswer(){
 if(!savedAnswer)return;
 const blob=new Blob(['\uFEFF'+savedAnswer.csv],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=savedAnswer.fileName;
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 document.getElementById('saveStatus').textContent='保存操作を開始しました。端末のファイル一覧でCSVを確認してください。';
}
async function shareAnswer(){
 if(!savedAnswer)return;
 const file=new File(['\uFEFF'+savedAnswer.csv],savedAnswer.fileName,{type:'text/csv'});
 try{
  if(!navigator.canShare?.({files:[file]})){alert('この端末ではファイル共有に対応していません。CSVを保存し、メールに手動で添付してください。');return;}
  await navigator.share({files:[file],title:'試験答案',text:'受験番号：'+savedAnswer.studentId+'　試験コード：'+savedAnswer.examCode});
 }catch(e){if(e.name!=='AbortError')alert('共有できませんでした。CSVを保存し、メールに添付してください。');}
}
function showSavedAnswer(){
 document.getElementById('main').style.display='none';document.getElementById('startScreen').style.display='none';
 closeWarning();document.getElementById('endScreen').style.display='flex';
 document.getElementById('endMessage').textContent='終了理由：'+savedAnswer.reason+'／答案：'+savedAnswer.fileName;
}
submitExam=async function(forced,reason){
 if(examEnded||!remoteActive)return;
 if(!forced&&!confirm('試験を終了し、答案CSVを保存しますか？'))return;
 const submitTime=now();
 const csv='提出タイプ\r\n'+csvCell(reason)+'\r\n\r\nstudentId,studentName,examCode,examFile,startTime,submitTime\r\n'+[studentId,studentName,examCode,loadedExamFile,startTime,submitTime].map(csvCell).join(',')+'\r\n\r\n問題番号,ID,解答\r\n'+collectAnswers()+'\r\n';
 savedAnswer={csv,fileName:[studentId,studentName,examCode,Date.now()].map(safeName).join('_')+'.csv',reason,studentId,examCode};
 examEnded=true;remoteActive=false;clearInterval(timerInterval);logEvent('SUBMIT',reason);
 try{localStorage.setItem(answerStorageKey,JSON.stringify(savedAnswer));}catch{document.getElementById('saveStatus').textContent='ブラウザ内の保管ができません。画面を閉じる前にCSVを保存してください。';}
 showSavedAnswer();downloadAnswer();
};
// 元コードの離脱判定は受験中だけ実行（開始前や終了後のメール操作は対象外）。
// capture段階で未受験時のイベントを止め、既存の3回判定は維持します。
document.addEventListener('visibilitychange',e=>{if(!remoteActive)e.stopImmediatePropagation();},true);
window.addEventListener('beforeunload',e=>{if(!remoteActive&&!window.captureHasUnsavedData)e.stopImmediatePropagation();},true);
const extra=document.createElement('div');extra.className='answer-actions';
extra.innerHTML='<button id="saveAnswerButton" type="button">答案CSVを保存／再保存</button><button id="shareAnswerButton" type="button">答案を共有（メール等）</button><p id="saveStatus" role="status"></p><p class="save-help">保存だけでは先生への提出は完了しません。保存したCSVをメールに添付し、指定の宛先へ送信してください。<br>iPhoneでは保存先を「ファイル」アプリで確認するか、共有ボタンからメールを選択してください。共有の対応は端末によって異なります。</p>';
document.getElementById('endScreen').appendChild(extra);
document.getElementById('saveAnswerButton').onclick=downloadAnswer;document.getElementById('shareAnswerButton').onclick=shareAnswer;
const notice=document.createElement('p');notice.className='save-help';notice.textContent='試験時間：30分。画面離脱3回で試験終了（元の設定）。終了後は答案CSVを保存し、メールで送ってください。';document.getElementById('startScreen').appendChild(notice);
try{
 const old=JSON.parse(localStorage.getItem(answerStorageKey)||'null');
 if(old?.csv&&old?.fileName){const btn=document.createElement('button');btn.type='button';btn.textContent='前回終了した答案を再保存する';btn.onclick=()=>{savedAnswer=old;examEnded=true;showSavedAnswer();};document.getElementById('startScreen').appendChild(btn);}
}catch{}
