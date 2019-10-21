const to_floor_plans_folder = "floor_plans/";
const to_symbols_folder = "symbols/";

var current_url = new URL(window.location);
var from_room = current_url.searchParams.get("from_room");
var to_room = current_url.searchParams.get("to_room");
var lang = current_url.searchParams.get("lang");

var smartphone = true;
console.log("width: " + window.innerWidth + " - height: " + window.innerHeight)
if (window.innerWidth > window.innerHeight) {
    smartphone = false;
}
console.log("Smartphone: " + smartphone)

var language_index = 0; // taking German as the default value
if (lang) {
    if (stringsAreEqual(lang, "en")) {
        language_index = 1;
    }
}

$(function() {
    // Seite ist geladen
    document.title = strings["title_application"][language_index];
    $("#label_from_room").text(strings["from_room"][language_index])
    $("#label_to_room").text(strings["to_room"][language_index])
    $("#label_level").text(strings["level"][language_index])
    $("#label_cancel").text(strings["cancel"][language_index])
    $("#label_next_step").text(strings["next_step"][language_index])
    if (from_room) {
        $("#value_from_room").text(from_room)
        $("#value_level").text(from_room.substr(0, 1))
    }
    if (to_room) {
        $("#value_to_room").text(to_room)
    }
    if (!smartphone) {
        $('.header').removeClass('header').addClass('header_desktop');
        $('.labels_header_table').removeClass('labels_header_table').addClass('labels_header_table_desktop');
        $('.cancel_table_field').removeClass('cancel_table_field').addClass('cancel_table_field_desktop');
        $('.next_step_table_field').removeClass('next_step_table_field').addClass('next_step_table_field_desktop');
        $('.labels_footer_table').removeClass('labels_footer_table').addClass('labels_footer_table_desktop');
    }
    setImageWithoutRoute();
});

function stringsAreEqual(str1, str2) {
    if (str1.localeCompare(str2) == 0) {
        return true;
    } else {
        return false;
    }
}

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

function setImageWithoutRoute() {
    var ctx = document.getElementById('canvas').getContext('2d');
    var canvas = document.getElementById('canvas');
    size = $(window).width();
    if ($(window).width() > $(window).height()) size = size / 3; // Desktop Version
    canvas.width = size;
    canvas.height = size;
    var img = new Image();
    img.onload = function() {

    };
    img.src = to_floor_plans_folder + '1OG.png';
}