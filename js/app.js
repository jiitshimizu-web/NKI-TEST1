/* =========================================
   手動ファイル読込
========================================= */

document.getElementById("fileInput")
.addEventListener("change",e=>{

    let f=e.target.files[0];

    if(!f) return;

    loadedExamFile=f.name;

    let r=new FileReader();

    r.onload=ev=>{

        loadQuestions(
            ev.target.result
        );
    };

    r.readAsText(f,"utf-8");
});

/* =========================================
   問題読込共通
========================================= */

function loadQuestions(text){

    const raw=parseCSV(text);

    mergedQuestions=
        buildQuestionBlocks(raw);

    render();

    startTimer();

    document.getElementById(
        "loadedExamInfo"
    ).innerText=
        `読込済み：${loadedExamFile}`;
}

/* =========================================
   試験コードから読込
========================================= */

async function loadExamByCode(code){

    try{

        const mapRes=await fetch(
            "data/exam_map.csv"
        );

        const mapText=
            await mapRes.text();

        const mapData=
            parseCSV(mapText);

        const row=mapData.find(r=>
            String(r["試験コード"]||"")
            .trim()===code
        );

        if(!row){

            alert("試験コードが存在しません");

            return false;
        }

        const file=
            String(
                row["試験問題"]||""
            ).trim();

        if(!file){

            alert("問題ファイル未設定");

            return false;
        }

        loadedExamFile=file;

        const examRes=await fetch(
            `data/${file}`
        );

        if(!examRes.ok){

            alert(
                "問題ファイルが見つかりません"
            );

            return false;
        }

        const examText=
            await examRes.text();

        loadQuestions(examText);

        return true;

    }catch(err){

        console.error(err);

        alert(
            "問題読込エラー"
        );

        return false;
    }
}

/* =========================================
   ページ離脱
========================================= */

window.addEventListener(
    "beforeunload",
    e=>{

        if(!examEnded){

            e.preventDefault();

            e.returnValue='';
        }
    }
);