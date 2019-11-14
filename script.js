const to_floor_plans_folder = "floor_plans/";
const to_symbols_folder = "symbols/";
const from_room_param_str = "from_room";
const to_room_param_str = "to_room";
const language_param_str = "lang";

var current_url = new URL(window.location);
var from_room = current_url.searchParams.get(from_room_param_str);
var to_room = current_url.searchParams.get(to_room_param_str);
var lang = current_url.searchParams.get(language_param_str);
var screen_width = window.innerWidth;
if (to_room) {
    var to_level = to_room.substr(0, 1);
}

var institutes = {};
var rooms_order_after_level = {};
var rooms_order_after_roomnr = {};
var etagen_nummer = null;

var smartphone = true;
var mapfullwidth = true;
console.log("width: " + window.innerWidth + " - height: " + window.innerHeight)
if (window.innerWidth > window.innerHeight) {
    smartphone = false;
}
if (window.innerWidth * 1.7 > window.innerHeight) {
    mapfullwidth = false;
}
console.log("Smartphone: " + smartphone)
console.log("Map full width: " + mapfullwidth)

var language_index = 0; // taking German as the default value
if (lang) {
    if (stringsAreEqual(lang, "en")) {
        language_index = 1;
    } else if (stringsAreEqual(lang, "es")) {
        language_index = 2;
    }
    $("#language_spinner").val(lang);
} else {
    lang = "de";
}

var from_room_object = null;
var to_room_object = null;

$('#language_spinner').on('change', function() {
    var current_loc = window.location + "";
    var end_loc = current_loc.substr(0, current_loc.indexOf(".html") + 5) + "?" + language_param_str + "=" + this.value;
    if (from_room) {
        end_loc += "&" + from_room_param_str + "=" + from_room;
    }
    if (to_room) {
        end_loc += "&" + to_room_param_str + "=" + to_room;
    }
    window.location = end_loc;
});

class Room {
    constructor(json) {
        this.room_nr = json["no"];
        this.category = json["category"];
        this.institute = institutes[json["institute"]];
        this.level = json["level"];
        this.door_coordinates = [json["doorX"], json["doorY"]];
        this.spatial_extend = [
            [json["x1"], json["y1"]],
            [json["x2"], json["y2"]]
        ];
        this.openingHours = [json["hoursStart"], json["hoursEnd"]];
        this.description = json["description"];
    }
}

class Institute {
    constructor(json) {
        this.name = json["name_de"];
        this.json = json;
        this.getName();
        this.id = json["id"];
    }

    getName() {
        if (stringsAreEqual(lang, "en")) {
            this.name = this.json["name_en"];
        } else if (stringsAreEqual(lang, "es")) {
            this.name = this.json["name_es"];
        }
    }
}

function api(type, query) {
    var authorization_key = '1234';
    var url = 'https://christian-terbeck.de/projects/ba/request.php';

    $.ajax({
        type: 'POST',
        url: url,
        data: { authorization_key: authorization_key, type: type, data: query },
        timeout: 60000,
        success: function(data) {
            if (data.status == 'success') {
                if (stringsAreEqual(query, "all") && stringsAreEqual(type, "rooms")) {
                    for (var i in data) {
                        if (!rooms_order_after_level.hasOwnProperty(data[i]["level"])) {
                            rooms_order_after_level[data[i]["level"]] = [];
                        }
                        if (data[i].hasOwnProperty("no")) {
                            var room = new Room(data[i]);
                            rooms_order_after_level[data[i]["level"]].push(room)
                            rooms_order_after_roomnr[data[i]["no"]] = room;
                        }
                    }
                    onRoomsLoaded();
                } else if (stringsAreEqual(query, "all") && stringsAreEqual(type, "institutes")) {
                    for (var i in data) {
                        if (data[i].hasOwnProperty("name_de")) {
                            institutes[data[i]["id"]] = new Institute(data[i])
                        }
                    }
                }
            }
        },
        error: function(data) {

            console.log('unable to connect: ' + data);
        }
    });
}

$(function() {
    storeRoomsOfBuilding();
});

function onRoomsLoaded() {
    // rooms from database are loaded
    from_room_object = rooms_order_after_roomnr[from_room];
    to_room_object = rooms_order_after_roomnr[to_room];

    document.title = strings["title_application"][language_index];
    $("#label_cancel").text(strings["cancel"][language_index])
    $("#label_next_step").text(strings["next_step"][language_index])
    $("#etagen_btn1").text(strings["floor_1"][language_index])
    $("#etagen_btn2").text(strings["floor_2"][language_index])
    $("#etagen_btn3").text(strings["floor_3"][language_index])
    $("#etagen_btn4").text(strings["floor_4"][language_index])
    $("#etagen_btn5").text(strings["floor_5"][language_index])
    $("#etagen_btn6").text(strings["floor_6"][language_index])
    $("#etagen_btn7").text(strings["floor_7"][language_index])
    if (from_room_object) {
        $("#label_from_room").text(strings["from_room"][language_index])
        $("#value_from_room").text(from_room)
            // get level of room
        $("#label_level").text(strings["level"][language_index])
        $("#value_level").text($("#etagen_btn" + Number(from_room_object.level)).text())
        $("#etagen_btn" + Number(from_room_object.level)).removeClass("btn-default").addClass("btn-danger");
        if (!to_room_object) {
            setImageWithoutRoute((from_room_object.level - 2) + "", null);
        } else {
            // TODO: set image with route
            setImageWithoutRoute((from_room_object.level - 2) + "", null);
        }
        etagen_nummer = from_room_object.level;
    } else {
        setImageWithoutRoute(3, null);
        etagen_nummer = 3;
    }
    if (to_room_object) {
        $("#label_to_room").text(strings["to_room"][language_index])
        $("#value_to_room").text(to_room)
        $("#etagen_btn" + (Number(to_room_object.level))).removeClass("btn-default").addClass("btn-success");

        // no autocomplete input needed
        $(".autocomplete").css("display", "none");
    } else {
        $(".arrow_table").css("display", "none");
        $("#autocomplete_search").attr("placeholder", strings["autocomplete_placeholder"][language_index]);
        var autocomplete_options = [];
        for (var i in rooms_order_after_roomnr) {
            autocomplete_options.push(i + " - " + rooms_order_after_roomnr[i]["institute"]["name"])
        }
        autocomplete(document.getElementById("autocomplete_search"), autocomplete_options);
    }
    if (!smartphone) {
        $('.header').removeClass('header').addClass('header_desktop');
        $('.labels_header_table').removeClass('labels_header_table').addClass('labels_header_table_desktop');
        $('.cancel_table_field').removeClass('cancel_table_field').addClass('cancel_table_field_desktop');
        $('.next_step_table_field').removeClass('next_step_table_field').addClass('next_step_table_field_desktop');
        $('.labels_footer_table').removeClass('labels_footer_table').addClass('labels_footer_table_desktop');
    } else {
        $(".etagen_btn").css("height", "70");
        $(".etagen_btn").css("padding-top", "12");
        $(".etagen_btn").css("font-size", "1.8em");
    }
    if (mapfullwidth) {
        $(".arrow_table").css("maxWidth", window.innerHeight);
        $("#arrow").css("maxWidth", (window.innerHeight - window.innerWidth) / 3);
    } else {
        $(".arrow_table").css("maxWidth", "50%");
    }
}

function storeRoomsOfBuilding() {
    api("institutes", "all")
    api("rooms", "all")
}

function stringsAreEqual(str1, str2) {
    if (str1.localeCompare(str2) == 0) {
        return true;
    } else {
        return false;
    }
}

$(".etagen_btn").on("click", function() {
    etagen_nummer = Number(this.id.replace("etagen_btn", ""))
    if (etagen_nummer == 1) {
        setImageWithoutRoute("-1", null);
    } else setImageWithoutRoute((etagen_nummer - 2) + "", null)
});

window.onscroll = function() { remainHeaderOnTop() };

var header = document.getElementById("myHeader");
var sticky = header.offsetTop;

function remainHeaderOnTop() {
    if (window.pageYOffset > sticky) {
        header.classList.add("sticky");
    } else {
        header.classList.remove("sticky");
    }
}

function setImageWithoutRoute(level, roomHighlighted) {
    var ctx = document.getElementById('canvas').getContext('2d');
    var canvas = document.getElementById('canvas');
    if (!mapfullwidth) screen_width = screen_width * 4.5 / 10; // Desktop Version
    canvas.width = screen_width;
    canvas.height = screen_width;
    var img = new Image();
    img.onload = function() {
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, screen_width, screen_width);
        if (from_room_object && etagen_nummer == from_room_object.level) {
            // draw circle at the current position of the user
            drawCircle(ctx, from_room_object.door_coordinates[0] * canvas.width / 100, from_room_object.door_coordinates[1] * canvas.height / 100)
        }
        if (roomHighlighted) {
            highLightRoom(ctx, roomHighlighted.spatial_extend, canvas.width, canvas.height)
        }
    };
    img.src = getImageURLForLevel(level);
}

function highLightRoom(ctx, spatial_extend, cvwidth, cvheight) {
    ctx.beginPath();
    ctx.rect(spatial_extend[0][0] * cvwidth / 100, spatial_extend[0][1] * cvheight / 100, (spatial_extend[1][0] - spatial_extend[0][0]) * cvwidth / 100, (spatial_extend[1][1] - spatial_extend[0][1]) * cvheight / 100);
    ctx.fillStyle = "rgba(124, 252, 0, 0.4)"; // green with transparence
    ctx.fill();
    ctx.stroke();
}

function drawCircle(ctx, centerX, centerY) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, 15, 0, 2 * Math.PI, false);
    ctx.fillStyle = 'red';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#003300';
    ctx.stroke();
}

var canvas = document.querySelector('canvas');
canvas.addEventListener('click', function(e) {
    if (to_room_object) {
        return;
    }
    var totalOffsetX = 0;
    var totalOffsetY = 0;
    var canvasX = 0;
    var canvasY = 0;
    var currentElement = this;

    do {
        totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
        totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
    }
    while (currentElement = currentElement.offsetParent)

    canvasX = event.pageX - totalOffsetX;
    canvasY = event.pageY - totalOffsetY;

    var mouseX = (canvasX / this.width) * 100;
    var mouseY = (canvasY / this.height) * 100;
    for (var i in rooms_order_after_level[etagen_nummer]) {
        var room_obj = rooms_order_after_level[etagen_nummer][i];
        if (pointIsWithinSpatialExtend([mouseX, mouseY], room_obj.spatial_extend)) {
            setImageWithoutRoute((etagen_nummer - 2) + "", room_obj)
            $("#room_details").css("display", "block");
            $("#room_details").html("<b>" + strings["room_nr"][language_index] + ":</b> " + room_obj.room_nr + "<span style='padding-left:25px'><btn class='btn btn-primary' onclick='setToRoom(" + room_obj.room_nr + ")' style='font-size:0.8em'>=> " + strings["navigate_to_room"][language_index] + "</btn></span><br>" +
                "<b>" + strings["institute"][language_index] + ": </b>" + room_obj.institute.name + "")

        }
    }
});

function pointIsWithinSpatialExtend(point, spatial_extend) {
    if (point[0] >= spatial_extend[0][0] && point[0] <= spatial_extend[1][0] &&
        point[1] >= spatial_extend[0][1] && point[1] <= spatial_extend[1][1]) {
        return true;
    } else {
        return false;
    }
}

function getImageURLForLevel(level) {
    var img_name = "EG.png"; // default value
    switch (level) {
        case "-1":
            img_name = "KG.png";
            break;
        case "0":
            img_name = "EG.png";
            break;
        case "1":
            img_name = "1OG.png";
            break;
        case "2":
            img_name = "2OG.png";
            break;
        case "3":
            img_name = "3OG.png";
            break;
        case "4":
            img_name = "4OG.png";
            break;
        case "5":
            img_name = "5OG.png";
            break;
        default:
            break;
    }
    return to_floor_plans_folder + img_name;

}

function setToRoom(to_room_number) {
    var current_loc = window.location + "";
    var end_loc = current_loc.substr(0, current_loc.indexOf(".html") + 5) + "?" + language_param_str + "=" + lang;
    if (from_room) {
        end_loc += "&" + from_room_param_str + "=" + from_room;
    }
    end_loc += "&" + to_room_param_str + "=" + to_room_number;
    window.location = end_loc;
}


function autocomplete(inp, arr) {
    /* source: https://www.w3schools.com/howto/howto_js_autocomplete.asp
    the autocomplete function takes two arguments,
    the text field element and an array of possible autocompleted values:*/
    var currentFocus;
    /*execute a function when someone writes in the text field:*/
    inp.addEventListener("input", function(e) {
        var a, b, i, val = this.value;
        /*close any already open lists of autocompleted values*/
        closeAllLists();
        if (!val) { return false; }
        currentFocus = -1;
        /*create a DIV element that will contain the items (values):*/
        a = document.createElement("DIV");
        a.setAttribute("id", this.id + "autocomplete-list");
        a.setAttribute("class", "autocomplete-items");
        /*append the DIV element as a child of the autocomplete container:*/
        this.parentNode.appendChild(a);
        /*for each item in the array...*/
        for (i = 0; i < arr.length; i++) {
            /*check if the item starts with the same letters as the text field value:*/
            //here
            if (oneOfWordsStartsWith(arr[i], val)) {
                /*create a DIV element for each matching element:*/
                b = document.createElement("DIV");
                /*make the matching letters bold:*/
                b.innerHTML = "<strong>" + arr[i].substr(0, val.length) + "</strong>";
                b.innerHTML += arr[i].substr(val.length);
                /*insert a input field that will hold the current array item's value:*/
                b.innerHTML += "<input type='hidden' value='" + arr[i] + "'>";
                /*execute a function when someone clicks on the item value (DIV element):*/
                b.addEventListener("click", function(e) {
                    /*insert the value for the autocomplete text field:*/
                    inp.value = this.getElementsByTagName("input")[0].value;
                    /*close the list of autocompleted values,
                    (or any other open lists of autocompleted values:*/
                    closeAllLists();
                    setToRoom(inp.value.substr(0, inp.value.indexOf("-")).replace(" ", ""));
                });
                a.appendChild(b);
            }
        }
    });
    /*execute a function presses a key on the keyboard:*/
    inp.addEventListener("keydown", function(e) {
        var x = document.getElementById(this.id + "autocomplete-list");
        if (x) x = x.getElementsByTagName("div");
        if (e.keyCode == 40) {
            /*If the arrow DOWN key is pressed,
            increase the currentFocus variable:*/
            currentFocus++;
            /*and and make the current item more visible:*/
            addActive(x);
        } else if (e.keyCode == 38) { //up
            /*If the arrow UP key is pressed,
            decrease the currentFocus variable:*/
            currentFocus--;
            /*and and make the current item more visible:*/
            addActive(x);
        } else if (e.keyCode == 13) {
            /*If the ENTER key is pressed, prevent the form from being submitted,*/
            e.preventDefault();
            if (currentFocus > -1) {
                /*and simulate a click on the "active" item:*/
                if (x) x[currentFocus].click();
            }
        }
    });

    function addActive(x) {
        /*a function to classify an item as "active":*/
        if (!x) return false;
        /*start by removing the "active" class on all items:*/
        removeActive(x);
        if (currentFocus >= x.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = (x.length - 1);
        /*add class "autocomplete-active":*/
        x[currentFocus].classList.add("autocomplete-active");
    }

    function removeActive(x) {
        /*a function to remove the "active" class from all autocomplete items:*/
        for (var i = 0; i < x.length; i++) {
            x[i].classList.remove("autocomplete-active");
        }
    }

    function closeAllLists(elmnt) {
        /*close all autocomplete lists in the document,
        except the one passed as an argument:*/
        var x = document.getElementsByClassName("autocomplete-items");
        for (var i = 0; i < x.length; i++) {
            if (elmnt != x[i] && elmnt != inp) {
                x[i].parentNode.removeChild(x[i]);
            }
        }
    }
    /*execute a function when someone clicks in the document:*/
    document.addEventListener("click", function(e) {
        closeAllLists(e.target);
    });
}

function oneOfWordsStartsWith(autocomplete_string, starting_string) {
    starting_string = starting_string.trim();
    var search_for = starting_string.split(" ");
    var words = autocomplete_string.split(/-| /);
    var count = 0;
    for (var j in search_for) {
        for (var i in words) {
            //words[i] = words[i].replace(" ", "");
            if (words[i].substr(0, search_for[j].length).toUpperCase() == search_for[j].toUpperCase()) {
                count++;
            }
        }
    }
    if (count == search_for.length) return true;
    return false;
}