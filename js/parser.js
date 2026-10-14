function parseCSV(data){

    data=data
        .replace(/^\uFEFF/, '')
        .replace(/\r\n/g,'\n')
        .replace(/\r/g,'\n');

    let rows=[];
    let row=[];
    let cur="";
    let inQ=false;

    for(let i=0;i<data.length;i++){

        let c=data[i];

        if(c==='"'){

            if(inQ && data[i+1]==='"'){

                cur+='"';

                i++;

            }else{

                inQ=!inQ;
            }

        }else if(
            (c===','||c==='\t')
            && !inQ
        ){

            row.push(cur);

            cur="";

        }else if(
            c==='\n'
            && !inQ
        ){

            row.push(cur);

            rows.push(row);

            row=[];

            cur="";

        }else{

            cur+=c;
        }
    }

    if(cur || row.length){

        row.push(cur);

        rows.push(row);
    }

    let headers=(rows[0]||[])
        .map(h=>h.trim());

    return rows
        .slice(1)
        .filter(r=>
            r.some(v=>
                String(v||"")
                .trim()!==""
            )
        )
        .map(r=>{

            let o={};

            headers.forEach((h,i)=>{

                o[h]=
                    (r[i]||"")
                    .trim();
            });

            return o;
        });
}

/* =========================================
   選択肢シャッフル
========================================= */

function shuffleChoices(question){

    if(!question) return question;

    const choices=[];

    /* =========================================
       選択肢取得
    ========================================= */

    for(let i=1;i<=10;i++){

        const key=`choice${i}`;

        if(question[key]){

            choices.push(
                question[key]
            );
        }
    }

    /* =========================================
       シャッフル
    ========================================= */

    shuffle(choices);

    /* =========================================
       再格納
    ========================================= */

    for(let i=1;i<=10;i++){

        const key=`choice${i}`;

        question[key]=
            choices[i-1]||"";
    }

    return question;
}

/* =========================================
   問題ブロック構築
========================================= */

function buildQuestionBlocks(list){

    const map=new Map();

    list.forEach((q,index)=>{

        const id=
            String(q.id||"")
            .trim();

        if(!id) return;

        const root=rootId(id);

        const isChild=
            id.includes("-");

        /* =========================================
           選択肢シャッフル
           ←追加
        ========================================= */

        shuffleChoices(q);

        if(!map.has(root)){

            map.set(root,{

                root,

                parent:null,

                children:[],

                originalIndex:index
            });
        }

        const group=map.get(root);

        /* =========================================
           子問題
        ========================================= */

        if(isChild){

            group.children.push({

                ...q,

                _originalIndex:index
            });

        }

        /* =========================================
           親問題
        ========================================= */

        else{

            group.parent={

                ...q,

                _originalIndex:index
            };

            group.originalIndex=index;
        }
    });

    const blocks=[];

    [...map.values()]
        .sort((a,b)=>
            a.originalIndex
            -b.originalIndex
        )
        .forEach(group=>{

            /* =========================================
               子問題シャッフル
            ========================================= */

            shuffle(group.children);

            /* =========================================
               親＋子
            ========================================= */

            if(
                group.parent
                &&
                group.children.length
            ){

                blocks.push({

                    type:"group",

                    data:{

                        parent:
                            group.parent,

                        children:
                            group.children
                    }
                });

                return;
            }

            /* =========================================
               単独親問題
            ========================================= */

            if(group.parent){

                blocks.push({

                    type:"single",

                    data:group.parent
                });

                return;
            }

            /* =========================================
               子のみ
            ========================================= */

            group.children.forEach(child=>{

                blocks.push({

                    type:"single",

                    data:child
                });
            });
        });

    /* =========================================
       親ブロックシャッフル
    ========================================= */

    shuffle(blocks);

    return blocks;
}