function render(){

    const form=document.getElementById("examForm");

    form.innerHTML="";

    let idx=0;

    mergedQuestions.forEach(item=>{

        if(item.type==="single"){

            form.appendChild(
                createQuestion(item.data, idx)
            );

            idx++;

            return;
        }

        const wrap=document.createElement("div");

        wrap.className="group-block";

        if(item.data.parent){

            const p=document.createElement("div");

            p.className="group-parent";

            p.innerHTML=`
                <div class="group-parent-title">
                    【問題】
                </div>

                <div class="question-text">
                    ${renderQuestionText(
                        item.data.parent.question || ""
                    )}
                </div>
            `;

            wrap.appendChild(p);
        }

        item.data.children.forEach(c=>{

            wrap.appendChild(
                createQuestion(c, idx)
            );

            idx++;
        });

        form.appendChild(wrap);
    });
}


/* ------------------------------
   問題文表示
------------------------------ */
function renderQuestionText(text){

    if(!text) return "";

    let html=esc(text);

    /* 改行 */
    html=html.replace(/\n/g,"<br>");

    /*
      [img:フォルダ名/画像名.png]
      ↓
      <img src="images/フォルダ名/画像名.png">
    */
    html=html.replace(
        /\[img:(.+?)\]/gi,
        (match,path)=>{

            const imgPath=`images/${path.trim()}`;

            return `
                <div class="question-image-wrap">
                    <img
                        src="${imgPath}"
                        class="question-image"
                        loading="lazy"
                        onerror="this.style.display='none'"
                    >
                </div>
            `;
        }
    );

    return html;
}


function createQuestion(q,i){

    const d=document.createElement("div");

    d.className="question";

    const type=(q.type||"").toLowerCase();

    d.innerHTML += `
        <p>問題${i+1}（${q["配点"]||0}点）</p>
    `;

    /* ------------------------------
       コード問題
    ------------------------------ */
    if(type==="pg"){

        d.innerHTML += `
            <pre class="code-block">
${esc(q.question || "")}
            </pre>
        `;

        /* 画像表示 */
        if(q.image){

            const imgPath=`images/${q.image}`;

            d.innerHTML += `
                <div class="question-image-wrap">
                    <img
                        src="${imgPath}"
                        class="question-image"
                        loading="lazy"
                        onerror="this.style.display='none'"
                    >
                </div>
            `;
        }

        d.innerHTML += `
            <textarea name="q${i}"></textarea>
        `;

        return d;
    }

    /* ------------------------------
       通常問題
    ------------------------------ */
    d.innerHTML += `
        <div class="question-text">
            ${renderQuestionText(q.question || "")}
        </div>
    `;

    /* CSV側に image 列がある場合 */
    if(q.image){

        const imgPath=`images/${q.image}`;

        d.innerHTML += `
            <div class="question-image-wrap">
                <img
                    src="${imgPath}"
                    class="question-image"
                    loading="lazy"
                    onerror="this.style.display='none'"
                >
            </div>
        `;
    }

    if(type==="normal") return d;

    /* ------------------------------
       選択問題
    ------------------------------ */
    if(type==="select"||type==="fill"){

        [
            q.choice1,
            q.choice2,
            q.choice3,
            q.choice4,
            q.choice5,
            q.choice6,
            q.choice7,
            q.choice8,
            q.choice9,
            q.choice10
        ]
        .filter(c=>c)
        .forEach(c=>{

            d.innerHTML += `
                <label>
                    <input
                        type="radio"
                        name="q${i}"
                        value="${esc(c)}"
                    >
                    ${esc(c)}
                </label>
            `;
        });

    }else{

        d.innerHTML += `
            <textarea name="q${i}"></textarea>
        `;
    }

    return d;
}