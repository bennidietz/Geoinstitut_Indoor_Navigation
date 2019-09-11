$(function() {
    // Seite ist geladen
});

$("#eg").click(function() {
    etageWechseln("EG.png", "#mapeg");
});

$("#og1").click(function() {
    etageWechseln("1OG.png", "#mapog1");
});

$("#og2").click(function() {
    etageWechseln("2OG.png", "#mapog2");
});

$("#og3").click(function() {
    etageWechseln("3OG.png", "#mapog3");
});

$("#og4").click(function() {
    etageWechseln("4OG.png", "#mapog4");
});

function etageWechseln(imgsource, used_map_id) {
    $("#img").attr("src",imgsource);
    $("#img").attr("usemap",used_map_id);
}

function mouseover(button) {
    document.getElementById('popup').style.display = 'block';
}

function link(button) {
  document.getElementById('popup').style.display = 'block';
}

$(document).ready(function(){
    var pfad1 = new Pfad(3.8,22.8,83.3, 22.8)
    var pfad2 = new Pfad(83.3,3.1,83.3,83.7)
    var pfad3 = new Pfad(16.7,83.7,97.7,83.7)
    var pfad4 = new Pfad(16.7,97.1,16.7,22.8)
    var pfad5 = new Pfad(16.7,52.2,83.3,52.2)
    var pfad6 = new Pfad(54.1,83.7,54.1,52.2)
    var pfad7 = new Pfad(23.7,52.2,23.7,22.8)
    var pfade = [pfad1, pfad2, pfad3, pfad4, pfad5, pfad6, pfad7]
    var startPunkt = [40.7, 19.8]; // 126
    //var startPunkt = [86.2, 52.3]; // 139
    //var endPunkt = [67.9, 19.8]; // 108
    //var endPunkt = [49.8, 85.8]; // 108
    //var endPunkt = [32,54]; // 147
    //var endPunkt = [67.7,85.8]; // 104
    var endPunkt = [96.7,85.8]; // 101
    //var endPunkt = [86.1,67.3]; // 140
    //var endPunkt = [14.2,52.5]; // 120

    punkte_route = getShortestPathBetweenPointsOnLevel(startPunkt, endPunkt);
    draw(punkte_route);


    function getShortestPathBetweenPointsOnLevel(startPunkt, endPunkt) {
        var routing_pfad = [startPunkt];
        var pfad_startPunkt = nearestPath(startPunkt);
        var pfad_endPunkt = nearestPath(endPunkt);
        routing_pfad.push(getNahstenPunktAufEinemPfad(startPunkt, pfad_startPunkt));
        if(JSON.stringify(pfad_startPunkt) == JSON.stringify(pfad_endPunkt)) {
            // nur auf einer Geraden
            routing_pfad.push(getNahstenPunktAufEinemPfad(endPunkt, pfad_startPunkt));
        } else if (zweiPfadeVerbunden(pfad_startPunkt, pfad_endPunkt) != null) {
            // Pfade sind verbunden
            routing_pfad.push(zweiPfadeVerbunden(pfad_startPunkt, pfad_endPunkt));
            routing_pfad.push(getNahstenPunktAufEinemPfad(endPunkt, pfad_endPunkt));
        } else {
            // komplizierter: finde den kürzesten Pfad zwischen zwei Linien 
            // (die nicht direkt miteinander verbunden sind)
            moegliche_pfade = []
            for (var i in pfade) {
            if (zweiPfadeVerbunden(pfad_startPunkt, pfade[i]) && 
                JSON.stringify(pfad_startPunkt) != JSON.stringify(pfade[i])) {
                    if (zweiPfadeVerbunden(pfade[i], pfad_endPunkt)) {
                        // Pfad direkt mit Ende Endpfad verbunden
                        moegliche_pfade.push([pfad_startPunkt, pfade[i], pfad_endPunkt]);
                    }
                        // zwei Zwischenpfade ?   
                        for (var j in pfade) {
                            if (zweiPfadeVerbunden(pfade[i], pfade[j]) && 
                                JSON.stringify(pfade[i]) != JSON.stringify(pfade[j])) {
                                if (zweiPfadeVerbunden(pfade[j], pfad_endPunkt)) {
                                    // Pfad mit Endpfad verbunden
                                    moegliche_pfade.push([pfad_startPunkt, pfade[i], pfade[j], pfad_endPunkt]);
                                }
                                    // drei Zwischenpfade ?
                                    for (var k in pfade) {
                                        if (zweiPfadeVerbunden(pfade[j], pfade[k]) && 
                                            JSON.stringify(pfade[j]) != JSON.stringify(pfade[k])) {
                                            if (zweiPfadeVerbunden(pfade[k], pfad_endPunkt)) {
                                                // Pfad mit Endpfad verbunden
                                                moegliche_pfade.push([pfad_startPunkt, pfade[i], pfade[j], pfade[k], pfad_endPunkt]);
                                            }
                                                // vier Zwischenpfade ?
                                                for (var l in pfade) {
                                                    if (zweiPfadeVerbunden(pfade[k], pfade[l]) && 
                                                        JSON.stringify(pfade[k]) != JSON.stringify(pfade[l])) {
                                                        if (zweiPfadeVerbunden(pfade[l], pfad_endPunkt)) {
                                                            // Pfad mit Endpfad verbunden
                                                            moegliche_pfade.push([pfad_startPunkt, pfade[i], pfade[j], pfade[k], pfade[l], pfad_endPunkt]);
                                                        }
                                                    }
                                                }
                                        }
                                    }
                            }
                        }
            }
            }
            kuerzesterPfad = null;
            kuezeste_distanz = 100000;
            for (var o in moegliche_pfade) {
                console.log(gesamtLaengePfad(startPunkt, moegliche_pfade[o], endPunkt))
                if(gesamtLaengePfad(startPunkt, moegliche_pfade[o], endPunkt) < kuezeste_distanz) kuerzesterPfad = moegliche_pfade[o];
            }
            for (var p = 0; p < kuerzesterPfad.length-1; p++) {
                routing_pfad.push(zweiPfadeVerbunden(kuerzesterPfad[p], kuerzesterPfad[p+1]));
            }
        }
        routing_pfad.push(getNahstenPunktAufEinemPfad(endPunkt, pfad_endPunkt));
        routing_pfad.push(endPunkt);
        return routing_pfad;
    }
    function draw(punkte_auf_pfad) {
        var ctx = document.getElementById('canvas').getContext('2d');
        var canvas = document.getElementById('canvas');
        size = $(window).width()*0.9;
        canvas.width = size;
        canvas.height = size;
        var img = new Image();
        img.onload = function() {
          ctx.drawImage(img, 0, 0, img.width, img.height,0,0,size,size);
          ctx.beginPath();
          ctx.moveTo(punkte_auf_pfad[0][0]*size/100, punkte_auf_pfad[0][1]*size/100);
          for (var i in punkte_auf_pfad) {
            ctx.lineTo(punkte_auf_pfad[i][0]*size/100, punkte_auf_pfad[i][1]*size/100);
          }
          ctx.strokeStyle = "#FF0000";
          ctx.lineWidth = 10;
          ctx.stroke();
        };
        img.src = '1OG.png';
      } 
    
    function gesamtLaengePfad(startPunkt, abfolge_linien, endPunkt) {
        var distanz = abstandGeradePunkt(startPunkt, abfolge_linien[0]);
        var letzter_punkt = startPunkt;
        for (var i = 0; i < abfolge_linien.length-1; i++) {
            var tmp_punkt = zweiPfadeVerbunden(abfolge_linien[i], abfolge_linien[i+1]);
            distanz += distanzZweierPunkte(letzter_punkt, tmp_punkt);
            letzter_punkt = tmp_punkt;
        }
        distanz += abstandGeradePunkt(endPunkt, abfolge_linien[abfolge_linien.length-1]);
        return distanz;
    }

    function nearestPath(startPunkt) {    
        var geringsterAbstand = 10000; // hoch initialisieren
        var nearestPfad = null;
        for (var i in pfade) {
            var jetzigerAbstand = abstandGeradePunkt(startPunkt, pfade[i]);
            if (jetzigerAbstand < geringsterAbstand) {
                nearestPfad = pfade[i];
                geringsterAbstand = jetzigerAbstand;
            }
        }
        return nearestPfad;
    }

});

class Pfad {
    constructor(x_start, y_start, x_end, y_end) {
        this.start_coor = [x_start, y_start]; // Startpunkt des Vektors
        this.end_coor = [x_end, y_end]; // Endpunkt des Vektors
        this.richtung = [x_end-x_start, y_end-y_start]; // Richtung des Vektors
    }
    
}

// gibt null zurück wenn die Pfade nicht verbunden sind
// gibt sonst den Punkt der Verbindung zurück
function zweiPfadeVerbunden(pfad1, pfad2) {
    if(abstandGeradePunkt(pfad1.start_coor, pfad2) == 0) {
        return getNahstenPunktAufEinemPfad(pfad1.start_coor, pfad2)
    } else if (abstandGeradePunkt(pfad1.end_coor, pfad2) == 0) {
        return getNahstenPunktAufEinemPfad(pfad1.end_coor, pfad2)
    } else if (abstandGeradePunkt(pfad2.start_coor, pfad1) == 0) {
        return getNahstenPunktAufEinemPfad(pfad2.start_coor, pfad1)
    } else if (abstandGeradePunkt(pfad2.end_coor, pfad1) == 0) {
        return getNahstenPunktAufEinemPfad(pfad2.end_coor, pfad1)
    } else {
        return null;
    }
}

function getNahstenPunktAufEinemPfad(punkt, pfad) {
    var start_coor = pfad.start_coor;
    var richtung = pfad.richtung;
    // siehe https://www.youtube.com/watch?v=mdtJjvsYdQg
    var zwischen = [start_coor[0]-punkt[0],start_coor[1]-punkt[1]];
    zwischen = zwischen[0]*richtung[0]+zwischen[1]*richtung[1]; // Skalarprodukt von Differenz und Richtungvektor
    var sp_rv_vr = richtung[0]*richtung[0]+richtung[1]*richtung[1];
    var r = (-1)*zwischen/sp_rv_vr;
    if (r > 1) r = 1;
    if (r < 0) r = 1; // abfangen, damit der Punkt nicht außerhalb der Linie liegt
    return resultierender_punkt = getPunktAufGerade(start_coor, richtung, r);
}

function abstandGeradePunkt(punkt, pfad) {
    return distanzZweierPunkte(punkt, getNahstenPunktAufEinemPfad(punkt, pfad))
}

function getPunktAufGerade(start_coor, richtung, r) {
    return [start_coor[0]+richtung[0]*r, start_coor[1]+richtung[1]*r];
}

function distanzZweierPunkte(start_coor, end_coor) {
    return Math.sqrt(Math.pow((start_coor[0]-end_coor[0]),2)+Math.pow((start_coor[1]-end_coor[1]),2))
}