async function startExam(){

    studentId=document
        .getElementById("studentId")
        .value
        .trim();

    studentName=document
        .getElementById("studentName")
        .value
        .trim();

    examCode=document
        .getElementById("examCode")
        .value
        .trim();

    /* 入力チェック */

    if(
        !studentId ||
        !studentName ||
        !examCode
    ){

        alert("入力してください");

        return;
    }

    /* 問題読込 */

    const ok=
        await loadExamByCode(
            examCode
        );

    if(!ok){

        return;
    }

    /* 開始時刻 */

    startTime=now();

    document.getElementById(
        "startScreen"
    ).style.display="none";

    document.getElementById(
        "main"
    ).style.display="flex";

    document.getElementById(
        "userInfo"
    ).innerText=
        `学籍番号：${studentId} / 名前：${studentName} / 試験コード：${examCode}`;

    logEvent(
        "START_EXAM",
        `code=${examCode}`
    );
}

function collectAnswers(){

    const data=[];

    let i=0;

    const f=document.getElementById("examForm");

    mergedQuestions.forEach(item=>{

        if(item.type==="single"){

            const type=
                (item.data.type||"")
                .toLowerCase();

            let v=
                (type==="normal")
                ? ""
                : (f[`q${i}`]?.value||"");

            v=`"${v.replace(/"/g,'""')}"`;

            data.push(
                `${i+1},"${item.data.id||""}",${v}`
            );

            i++;

        }else{

            item.data.children.forEach(c=>{

                const type=
                    (c.type||"")
                    .toLowerCase();

                let v=
                    (type==="normal")
                    ? ""
                    : (f[`q${i}`]?.value||"");

                v=`"${v.replace(/"/g,'""')}"`;

                data.push(
                    `${i+1},"${c.id||""}",${v}`
                );

                i++;
            });
        }
    });

    return data.join("\n");
}

async function submitExam(forced, reason){

    if(examEnded) return;

    examEnded=true;

    clearInterval(timerInterval);

    /* 提出時刻 */

    const submitTime=now();

    /* CSV作成 */

    const csv=
`提出タイプ
"${reason}"

studentId,studentName,examCode,examFile,startTime,submitTime
"${studentId}","${studentName}","${examCode}","${loadedExamFile}","${startTime}","${submitTime}"

問題番号,ID,解答
${collectAnswers()}
`;

    try{

        const res=await fetch(
            "/submit",
            {
                method:"POST",

                headers:{
                    "Content-Type":"application/json"
                },

                body:JSON.stringify({

                    fileName:
                        `${studentId}_${studentName}_${examCode}_${Date.now()}.csv`,

                    content:csv
                })
            }
        );

        const result=
            await res.json();

        if(!result.success){

            alert("保存失敗");

            return;
        }

    }catch(err){

        console.error(err);

        alert("サーバー保存失敗");

        return;
    }

/* ==========================
   PCへバックアップ保存
========================== */

const blob = new Blob(
    [
        "\uFEFF" + csv
    ],
    {
        type:"text/csv;charset=utf-8;"
    }
);

const url =
    URL.createObjectURL(blob);

const a =
    document.createElement("a");

a.href = url;

a.download =
    `${studentId}_${studentName}_${examCode}_${Date.now()}_backup.csv`;

document.body.appendChild(a);

a.click();

document.body.removeChild(a);

URL.revokeObjectURL(url);

    /* 終了画面 */

    document.getElementById(
        "main"
    ).style.display="none";

    document.getElementById(
        "endScreen"
    ).style.display="flex";

    document.getElementById(
        "endMessage"
    ).innerText=
        `提出種別：${reason}`;

    logEvent(
        "SUBMIT",
        reason
    );
}