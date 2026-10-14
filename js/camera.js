/* 受験者に見えるカメラ撮影。録画・写真は端末内で生成し、外部へ自動送信しません。 */
const captureSettings={photoWidth:320,photoHeight:240,jpegQuality:0.65,videoBps:128000,maxVideoBytes:64*1024*1024,maxPhotos:240};
let captureStream=null,captureRecorder=null,capturePhotos=[],captureChunks=[],captureNotes=[];
let captureMode='photos',captureInterval=30,captureTimer=null,captureStart='',captureEnd='',captureBytes=0;
let captureBusy=false,captureClosing=false,captureRunning=false,capturePending=Promise.resolve(),captureStopPromise=null;
let capturePhotoZip=null,captureVideo=null,captureStem='',captureMime='',captureFailCount=0;
const startBase=startExam,submitBase=submitExam;
function captureNote(type,detail=''){captureNotes.push({time:new Date().toISOString(),type,detail});}
function captureSize(bytes){return (bytes/1024/1024).toFixed(2)+' MB';}
const captureSetup=document.createElement('section');captureSetup.className='capture-setup';
captureSetup.innerHTML='<h3>受験中のカメラ撮影</h3><label>撮影方式 <select id="captureMode"><option value="photos">一定間隔の写真（メール添付向け）</option><option value="video">連続動画＋予備の写真</option></select></label><label>写真の間隔 <select id="captureInterval"><option value="15">15秒</option><option value="30" selected>30秒</option><option value="60">60秒</option></select></label><p id="captureEstimate"></p><p>前面カメラで撮影します。音声は録音しません。試験開始時にカメラの使用を許可してください。撮影データは端末へ保存し、先生へ送ります。</p>';
document.getElementById('startScreen').appendChild(captureSetup);
const captureBar=document.createElement('section');captureBar.id='captureBar';
captureBar.innerHTML='<video id="capturePreview" autoplay muted playsinline aria-label="カメラ映像"></video><div><strong id="captureStatus">カメラ準備前</strong><p id="captureCount">撮影前</p><p class="capture-small">画面ロック・別アプリへの切り替えを避けてください。</p></div>';
captureSetup.appendChild(captureBar);
const captureResult=document.createElement('section');captureResult.id='captureResult';captureResult.hidden=true;
captureResult.innerHTML='<h3>カメラ撮影データの保存</h3><p id="captureResultInfo" role="status"></p><button id="savePhotos" type="button" disabled>写真ZIPを保存</button> <button id="saveVideo" type="button" disabled>動画を保存</button> <button id="shareCapture" type="button" disabled>答案と撮影データを共有</button><p id="captureSaveStatus" role="status"></p><p class="capture-small">答案CSVと撮影ファイルをそれぞれ保存してください。動画がメールの添付上限を超える場合は写真ZIPを送ってください。保存前にページを閉じたり再読み込みしたりすると撮影データは失われます。</p>';
document.getElementById('endScreen').appendChild(captureResult);
function updateCaptureEstimate(){
 const seconds=Number(timeLimit)||1800,interval=Number(document.getElementById('captureInterval').value);
 const count=Math.floor(seconds/interval)+2;
 document.getElementById('captureEstimate').textContent=document.getElementById('captureMode').value==='video'
  ?`動画の目安：約${Math.ceil(seconds*captureSettings.videoBps/8/1024/1024)} MB（${Math.round(seconds/60)}分）。端末により増減します。写真も${interval}秒間隔で残します。`
  :`写真は開始・終了時と${interval}秒ごと（約${count}枚）。小さいJPEGをZIPにまとめます。容量は終了画面で確認できます。`;
}
document.getElementById('captureMode').onchange=updateCaptureEstimate;document.getElementById('captureInterval').onchange=updateCaptureEstimate;updateCaptureEstimate();
function updateCaptureStatus(){
 document.getElementById('captureCount').textContent=`写真 ${capturePhotos.length}枚 / 動画 ${captureSize(captureBytes)}`;
}
function releaseCaptureStream(){
 captureRunning=false;clearInterval(captureTimer);captureTimer=null;
 if(captureStream){for(const track of captureStream.getTracks())track.stop();captureStream=null;}
 document.getElementById('capturePreview').srcObject=null;
}
async function acquireCapture(){
 if(!navigator.mediaDevices?.getUserMedia)throw new Error('このブラウザでカメラを利用できません。公開HTTPSのURLをSafari／Chrome／Edgeで開いてください。');
 captureMode=document.getElementById('captureMode').value;captureInterval=Number(document.getElementById('captureInterval').value);
 if(captureMode==='video'&&!window.MediaRecorder){
  if(!confirm('この端末は連続動画に対応していません。一定間隔の写真に切り替えますか？'))throw new Error('カメラ撮影の準備を中止しました。');
  captureMode='photos';document.getElementById('captureMode').value='photos';updateCaptureEstimate();
 }
 captureStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'user'},width:{ideal:320},height:{ideal:240},frameRate:{ideal:8,max:10}}});
 const video=document.getElementById('capturePreview');video.srcObject=captureStream;
 await video.play();
 if(!video.videoWidth||!video.videoHeight){
  await new Promise((resolve,reject)=>{
   const ready=()=>{if(video.videoWidth){cleanup();resolve();}};
   const timeout=setTimeout(()=>{cleanup();reject(new Error('カメラ映像を取得できませんでした。再度お試しください。'));},10000);
   const cleanup=()=>{clearTimeout(timeout);video.removeEventListener('loadeddata',ready);};
   video.addEventListener('loadeddata',ready);ready();
  });
 }
 document.getElementById('captureStatus').textContent='カメラ準備完了';
}
async function takeCapturePhoto(){
 if(!captureRunning||!captureStream||capturePhotos.length>=captureSettings.maxPhotos)return;
 const video=document.getElementById('capturePreview');
 if(!video.videoWidth||!video.videoHeight){captureNote('PHOTO_SKIPPED','映像がありません');return;}
 const canvas=document.createElement('canvas');
 const scale=Math.min(captureSettings.photoWidth/video.videoWidth,captureSettings.photoHeight/video.videoHeight,1);
 canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('写真作成に対応していません。');
 ctx.drawImage(video,0,0,canvas.width,canvas.height);
 const time=new Date().toISOString();
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('写真を保存できませんでした。')),'image/jpeg',captureSettings.jpegQuality));
 capturePhotos.push({blob,time,width:canvas.width,height:canvas.height,file:'photo_'+String(capturePhotos.length+1).padStart(4,'0')+'.jpg'});
 updateCaptureStatus();
}
function queueCapturePhoto(){
 capturePending=capturePending.then(takeCapturePhoto).catch(e=>{
  captureFailCount++;captureNote('PHOTO_ERROR',e.message);document.getElementById('captureStatus').textContent='写真撮影に失敗しました。先生へ連絡してください。';
 });return capturePending;
}
function configureRecorder(){
 const types=['video/mp4','video/webm;codecs=vp8','video/webm'];
 const mime=types.find(t=>MediaRecorder.isTypeSupported(t));
 const opts={videoBitsPerSecond:captureSettings.videoBps};if(mime)opts.mimeType=mime;
 try{captureRecorder=new MediaRecorder(captureStream,opts);}catch{captureRecorder=new MediaRecorder(captureStream);}
 captureMime=captureRecorder.mimeType||mime||'';
 captureRecorder.ondataavailable=e=>{
  if(e.data?.size){captureChunks.push(e.data);captureBytes+=e.data.size;updateCaptureStatus();}
  if(captureBytes>captureSettings.maxVideoBytes&&captureRecorder.state!=='inactive'){
   captureNote('VIDEO_SIZE_LIMIT','64MBを超えたため動画停止。写真撮影は継続。');
   document.getElementById('captureStatus').textContent='動画容量上限のため写真撮影を継続中';stopCaptureRecorder();
  }
 };
 captureRecorder.onerror=e=>{
  captureNote('VIDEO_ERROR',e.error?.message||'録画エラー');
  document.getElementById('captureStatus').textContent='動画にエラー。予備の写真撮影を継続します。';
 };
 captureStopPromise=new Promise(resolve=>{captureRecorder.onstop=()=>{captureNote('VIDEO_STOP');resolve();};});
 captureRecorder.start(1000);captureNote('VIDEO_START',captureMime);
}
function stopCaptureRecorder(){
 if(!captureRecorder)return Promise.resolve();
 if(captureRecorder.state!=='inactive')captureRecorder.stop();
 return captureStopPromise||Promise.resolve();
}
async function beginCapture(){
 capturePhotos=[];captureChunks=[];captureNotes=[];captureBytes=0;captureFailCount=0;
 capturePhotoZip=null;captureVideo=null;captureRecorder=null;captureStopPromise=null;captureClosing=false;
 captureStart=new Date().toISOString();captureEnd='';captureStem='capture_'+(studentId.replace(/[^A-Za-z0-9_-]/g,'_')||'student')+'_'+Date.now();
 captureRunning=true;window.captureHasUnsavedData=true;captureNote('CAPTURE_START',captureMode);
 for(const track of captureStream.getVideoTracks()){
 track.addEventListener('mute',()=>{if(captureRunning){captureNote('CAMERA_MUTED');document.getElementById('captureStatus').textContent='カメラ映像が一時停止しています。画面を確認してください。';}});
 track.addEventListener('unmute',()=>{if(captureRunning){captureNote('CAMERA_UNMUTED');document.getElementById('captureStatus').textContent='カメラ映像が復帰しました';}});
 track.addEventListener('ended',()=>{
  if(!captureRunning||captureClosing)return;
  captureNote('CAMERA_ENDED','端末のカメラ映像が途切れました。');
  document.getElementById('captureStatus').textContent='カメラ映像が途切れました。先生へ連絡してください。';
 });}
 await queueCapturePhoto();
 if(!capturePhotos.length)throw new Error('開始時の写真を撮影できませんでした。カメラを確認してください。');
 if(captureMode==='video'){
  try{configureRecorder();}catch(e){
   captureNote('VIDEO_UNAVAILABLE',e.message);captureMode='photos';
   alert('連続動画を開始できなかったため、一定間隔の写真撮影を行います。');
  }
 }
 captureTimer=setInterval(()=>queueCapturePhoto(),captureInterval*1000);
 document.getElementById('captureStatus').textContent=captureMode==='video'?'● 動画録画中・予備写真も撮影':'● 写真撮影中（'+captureInterval+'秒間隔）';
 updateCaptureStatus();
}
// JPEGは既に圧縮済み。外部ライブラリを使わず、標準の無圧縮ZIPを生成。
const captureCRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function captureCRC32(bytes){let c=0xffffffff;for(const b of bytes)c=captureCRC[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
async function makeCaptureZip(files){
 const parts=[],central=[];let offset=0,centralSize=0;
 const encoder=new TextEncoder();
 for(const f of files){
  const name=encoder.encode(f.name),bytes=new Uint8Array(await f.blob.arrayBuffer()),crc=captureCRC32(bytes);
  const local=new Uint8Array(30+name.length),v=new DataView(local.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x0800,true);v.setUint16(10,0,true);v.setUint16(12,33,true);
  v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);local.set(name,30);
  const cen=new Uint8Array(46+name.length),cv=new DataView(cen.buffer);
  cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);cv.setUint16(14,33,true);
  cv.setUint32(16,crc,true);cv.setUint32(20,bytes.length,true);cv.setUint32(24,bytes.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);cen.set(name,46);
  parts.push(local,bytes);central.push(cen);offset+=local.length+bytes.length;centralSize+=cen.length;
 }
 const end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);
 return new Blob([...parts,...central,end],{type:'application/zip'});
}
async function finishCapture(reason){
 captureClosing=true;clearInterval(captureTimer);captureTimer=null;
 document.getElementById('captureStatus').textContent='撮影を終了しています…';
 try{
  await queueCapturePhoto();
  let stopTimeout;
  try{await Promise.race([stopCaptureRecorder(),new Promise((_,reject)=>{stopTimeout=setTimeout(()=>reject(new Error('録画終了がタイムアウトしました')),15000);})]);}
  catch(e){captureNote('VIDEO_STOP_ERROR',e.message);}
  finally{clearTimeout(stopTimeout);}
  captureEnd=new Date().toISOString();captureNote('CAPTURE_END',reason);
  if(captureChunks.length){
   const type=captureRecorder?.mimeType||captureMime||captureChunks[0].type;
   captureVideo=new Blob(captureChunks,{type});captureMime=type;
  }
 }finally{releaseCaptureStream();}
 const report={studentId,studentName,examCode,mode:captureMode,audio:false,startedAt:captureStart,endedAt:captureEnd,photoIntervalSeconds:captureInterval,reason,videoMime:captureMime,videoBytes:captureVideo?.size||0,photoFailures:captureFailCount,photos:capturePhotos.map(p=>({file:p.file,time:p.time,width:p.width,height:p.height,bytes:p.blob.size})),notes:captureNotes,eventLogs};
 const files=capturePhotos.map(p=>({name:p.file,blob:p.blob}));
 files.push({name:'capture_report.json',blob:new Blob([JSON.stringify(report,null,2)],{type:'application/json'})});
 capturePhotoZip=await makeCaptureZip(files);
 captureResult.hidden=false;
 const interrupted=captureNotes.some(n=>/ERROR|ENDED|MUTED|LIMIT|UNAVAILABLE/.test(n.type));
 const videoInfo=captureVideo?' / 動画 '+captureSize(captureVideo.size):'';
 document.getElementById('captureResultInfo').textContent=`写真 ${capturePhotos.length}枚 / 写真ZIP ${captureSize(capturePhotoZip.size)}${videoInfo}。`+(capturePhotos.length===0?'写真が撮影できていません。先生へ連絡してください。':'')+(captureVideo?.size>10*1024*1024?' 動画が大きいため、メール添付には写真ZIPの利用を検討してください。':'')+(interrupted?' 撮影の中断・変更記録があります。詳細はZIP内のcapture_report.jsonを確認してください。':'');
 document.getElementById('savePhotos').disabled=false;document.getElementById('saveVideo').disabled=!captureVideo;document.getElementById('saveVideo').hidden=!captureVideo;
 document.getElementById('shareCapture').disabled=false;
}
function downloadCapture(blob,name){
 if(!blob)return;const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 document.getElementById('captureSaveStatus').textContent='保存操作を開始しました。端末のファイル一覧で保存を確認してください。';
}
function captureVideoName(){return captureStem+(captureMime.includes('mp4')?'.mp4':'.webm');}
document.getElementById('savePhotos').onclick=()=>downloadCapture(capturePhotoZip,captureStem+'_photos.zip');
document.getElementById('saveVideo').onclick=()=>downloadCapture(captureVideo,captureVideoName());
document.getElementById('shareCapture').onclick=async()=>{
 const blob=captureVideo&&captureVideo.size<=10*1024*1024?captureVideo:capturePhotoZip;
 if(!blob||!savedAnswer)return;
 const mediaName=blob===captureVideo?captureVideoName():captureStem+'_photos.zip';
 const files=[new File(['\uFEFF'+savedAnswer.csv],savedAnswer.fileName,{type:'text/csv'}),new File([blob],mediaName,{type:blob.type})];
 try{
  if(!navigator.canShare?.({files})){alert('この端末はまとめて共有に対応していません。答案CSVと撮影ファイルを保存し、メールに手動で添付してください。');return;}
  await navigator.share({files,title:'試験答案とカメラ撮影データ',text:'受験番号：'+studentId+'　試験コード：'+examCode});
 }catch(e){if(e.name!=='AbortError')alert('共有できませんでした。それぞれ保存してメールへ添付してください。');}
};
startExam=async function(){
 if(captureBusy||remoteStarting||remoteActive||examEnded)return;
 if(!['studentId','studentName','examCode'].every(id=>document.getElementById(id).value.trim())){await startBase();return;}
 captureBusy=true;const button=document.querySelector('#startScreen button');button.disabled=true;
 try{
  await acquireCapture();await startBase();
  if(!remoteActive){releaseCaptureStream();return;}
  document.getElementById('main').insertBefore(captureBar,document.getElementById('examForm'));
  await beginCapture();
 }catch(e){
  releaseCaptureStream();window.captureHasUnsavedData=false;
  if(remoteActive){remoteActive=false;clearInterval(timerInterval);document.getElementById('main').style.display='none';document.getElementById('startScreen').style.display='flex';captureSetup.appendChild(captureBar);}
  document.getElementById('captureStatus').textContent='カメラの準備に失敗しました';
  alert(e.name==='NotAllowedError'?'カメラ使用が許可されていません。ブラウザのサイト設定でカメラを許可して再度開始してください。':e.message);
 }finally{captureBusy=false;button.disabled=false;}
};
submitExam=async function(forced,reason){
 if(captureClosing||examEnded||!remoteActive)return;
 if(!forced&&!confirm('試験を終了し、答案CSVとカメラ撮影データを保存しますか？'))return;
 captureClosing=true;
 await submitBase(true,reason);
 captureResult.hidden=false;document.getElementById('captureResultInfo').textContent='撮影データを作成しています。この画面を閉じないでください。';
 try{await finishCapture(reason);}catch(e){releaseCaptureStream();captureNote('FINISH_ERROR',e.message);document.getElementById('captureResultInfo').textContent='撮影ファイル作成に失敗しました。答案CSVを保存し、先生へ連絡してください。';}
};
// 撮影データの作成・保存前は終了後もページを閉じないよう確認を出す。
window.addEventListener('beforeunload',e=>{if(capturePhotos.length||captureChunks.length){e.preventDefault();e.returnValue='';}});
