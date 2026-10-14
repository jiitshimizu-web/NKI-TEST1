function now(){
    return new Date().toLocaleString();
}

function esc(s){
    return (s||"")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;");
}

function shuffle(a){

    for(let i=a.length-1;i>0;i--){

        let j=Math.floor(Math.random()*(i+1));

        [a[i],a[j]]=[a[j],a[i]];
    }
}

function rootId(id){
    return String(id||"").trim().split("-")[0];
}

function logEvent(type, detail=""){

    const row={
        time:new Date().toLocaleString(),
        type,
        detail
    };

    eventLogs.push(row);

    console.log(
        `[LOG] ${row.time} | ${type} | ${detail}`
    );
}