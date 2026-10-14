function startTimer(){

    clearInterval(timerInterval);

    let t=Number(timeLimit);

    function updateTimer(){

        const mm=String(
            Math.floor(t/60)
        ).padStart(2,"0");

        const ss=String(
            t%60
        ).padStart(2,"0");

        document.getElementById("timer")
            .innerText=`${mm}:${ss}`;

        if(t<=0){

            submitExam(
                true,
                "時間切れ"
            );

            return;
        }

        t--;
    }

    updateTimer();

    timerInterval=setInterval(
        updateTimer,
        1000
    );
}