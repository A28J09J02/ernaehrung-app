/* App-Gefühl: kleine Bausteine, die überall gelten (Haptik bei Schaltern, Tipp auf Kopfzeile = nach oben).
   Gesten selbst (Tageswechsel, Wischen zum Löschen, Ziehen zum Aktualisieren, Fenster wegwischen) liegen in index.html bzw. todos.js. */
(function(){
 /* Umschalter (Kontrollkästchen/Schalter) geben beim Umlegen einen leichten Tick */
 document.addEventListener("change",ev=>{const t=ev.target;
  if(t&&t.tagName==="INPUT"&&t.type==="checkbox"&&!t.closest("#hpt")&&typeof haptic==="function")haptic()},true);
 /* Tipp auf die Kopfzeile (nicht auf einen Knopf) rollt weich nach oben – wie in iOS-Apps */
 document.addEventListener("click",ev=>{const t=ev.target;
  if(!t.closest||!t.closest(".top")||t.closest("button,a,input,select,textarea,summary"))return;
  if(scrollY>4)scrollTo({top:0,behavior:"smooth"})});
})();
