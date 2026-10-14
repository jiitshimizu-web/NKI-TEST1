function showWarning(msg){

    document.getElementById(
        "warningText"
    ).innerText=msg;

    document.getElementById(
        "warningOverlay"
    ).style.display="flex";
}

function closeWarning(){

    document.getElementById(
        "warningOverlay"
    ).style.display="none";
}

/* コピー禁止 */

document.addEventListener("keydown", e=>{

    const tag=document
        .activeElement
        .tagName
        .toLowerCase();

    if(tag==="textarea") return;

    if(e.ctrlKey || e.metaKey){

        const k=e.key.toLowerCase();

        if(
            k==="c" ||
            k==="x" ||
            k==="a"
        ){

            e.preventDefault();

            warningCount++;

            showWarning(
                "問題文のコピーは禁止されています"
            );
        }
    }
});

document.addEventListener("contextmenu", e=>{

    if(
        e.target.tagName.toLowerCase()
        ==="textarea"
    ){
        return;
    }

    e.preventDefault();

    warningCount++;

    showWarning(
        "右クリックは禁止されています"
    );
});

document.addEventListener("copy", e=>{

    const tag=document
        .activeElement
        .tagName
        .toLowerCase();

    if(tag==="textarea") return;

    e.preventDefault();

    warningCount++;

    showWarning("コピーは禁止されています");
});

/* 離脱検知 */

document.addEventListener(
    "visibilitychange",
    ()=>{

        if(document.hidden && !examEnded){

            leaveCount++;

            warningCount++;

            showWarning(
                `画面離脱 ${leaveCount}/${maxLeave}`
            );

            if(leaveCount>=maxLeave){

                submitExam(
                    true,
                    "不正提出"
                );
            }
        }
    }
);