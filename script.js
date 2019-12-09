const to_floor_plans_folder = "http://christian-terbeck.de/projects/ba/img/levels/";
const to_symbols_folder = "symbols/";
const from_room_param_str = "from_room";
const to_room_param_str = "to_room";
const language_param_str = "lang";
const only_elevator_param_str = "only_elevator";

var current_url = new URL(window.location);
var from_room = current_url.searchParams.get(from_room_param_str);
var to_room = current_url.searchParams.get(to_room_param_str);
var lang = current_url.searchParams.get(language_param_str);
var elev = current_url.searchParams.get(only_elevator_param_str);
var only_elevator = false;
if (elev && Number(elev) == 1) {
    only_elevator = true;
}
var screen_width = window.innerWidth;
var scale_desktop_version_canvas = 6 / 10;
if (to_room) {
    var to_level = to_room.substr(0, 1);
}
var current_step = 0;
var second_route = false;
var current_instruction = 0;
var instructions = [];
var used_stairs_elevator = null;
const length_of_buidling = 45;
var ctx = document.getElementById('canvas').getContext('2d');

var rooms_order_after_level = {};
var rooms_order_after_roomnr = {};
var paths = {};
var etagen_nummer = null;
var shortest_nav_path1 = null;
var shortest_nav_path2 = null;
var currently_selected_room = null;
var strais_elevators = [];

var smartphone = true;
var mapfullwidth = true;
console.log("width: " + window.innerWidth + " - height: " + window.innerHeight)
if (window.innerWidth > window.innerHeight) {
    smartphone = false;
}
if (window.innerWidth * 1.68 > window.innerHeight) {
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
    var end_loc = "";
    if (current_loc.indexOf(".html") > -1) {
        end_loc = current_loc.substr(0, current_loc.indexOf(".html") + 5) + "?" + language_param_str + "=" + this.value;
    } else {
        end_loc = current_loc.substr(0, current_loc.lastIndexOf("/")) + "?" + language_param_str + "=" + this.value;
    }
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
        this.institute = json["institute"];
        this.institute["name"] = this.getInstitutName(json["institute"]);
        this.level = json["level"]["id"];
        this.door_coordinates = [Number(json["doorX"]), Number(json["doorY"])];
        this.spatial_extend = [
            [Number(json["x1"]), Number(json["y1"])],
            [Number(json["x2"]), Number(json["y2"])]
        ];
        this.openingHours = [json["hoursStart"], json["hoursEnd"]];
        this.description = json["description"];
        this.width = Number(json["x2"]) - Number(json["x1"]);
        this.height = Number(json["y2"]) - Number(json["y1"]);
        this.people = [];
        for (var i in json["people"]) {
            this.people.push(json["people"][i]);
        }
    }

    getInstitutName(institut_json) {
        if (stringsAreEqual(lang, "en")) {
            return institut_json["name_en"];
        } else if (stringsAreEqual(lang, "es")) {
            return institut_json["name_es"];
        } else {
            return institut_json["name_de"];
        }
    }
}

class RouteInstruction {
    constructor(direction, distance, decisionPoint, from_qr_code) {
        this.level_change = null;
        if (direction == null) {
            this.level_change = to_room_object.level;
        }
        this.direction = direction;
        this.distance = distance;
        this.decisionPoint = decisionPoint;
        this.from_qr_code = from_qr_code;
    }

}


class Route {
    constructor(pointA, pointB, start_path, end_path, from_qr_code) {
        this.startPoint = pointA;
        this.endPoint = pointB;
        this.direction = getDirectionOfRoute(pointA, pointB);
        this.distance = Math.round(distanceBetweenTwoPoints(pointA, pointB) * length_of_buidling / 100);
        this.from_qr_code = from_qr_code;
        this.start_path = start_path;
        this.end_path = end_path;
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

class Paths {
    constructor(json) {
        this.startPoint = [Number(json["x1"]), Number(json["y1"])];
        this.endPoint = [Number(json["x2"]), Number(json["y2"])];
        if (json["level"] && json["level"].hasOwnProperty("id")) {
            this.level = Number(json["level"]["id"]);
        } else {
            // related to all levels
            this.level = "*";
        }
        this.direction = [roundWithTwoDecimals(this.endPoint[0] - this.startPoint[0]), roundWithTwoDecimals(this.endPoint[1] - this.startPoint[1])]; // direction of vector
    }
}

function getNearestPointOnPath(pointA, pathA) {
    var start_coor = pathA.startPoint;
    var direction = pathA.direction;
    // source: https://www.youtube.com/watch?v=mdtJjvsYdQg
    var zwischen = [start_coor[0] - pointA[0], start_coor[1] - pointA[1]];
    zwischen = zwischen[0] * direction[0] + zwischen[1] * direction[1]; // Skalarprodukt von Differenz und Richtungvektor
    var sp_rv_vr = direction[0] * direction[0] + direction[1] * direction[1];
    var r = (-1) * zwischen / sp_rv_vr;
    if (r > 1) r = 1;
    if (r < 0) r = 1; // abfangen, damit der Punkt nicht außerhalb der Linie liegt
    return resultierender_punkt = getCertainPointOnPaths(start_coor, direction, r);
}

function distanceBetweenTwoPoints(start_coor, end_coor) {
    return roundWithTwoDecimals(Math.sqrt(Math.pow((start_coor[0] - end_coor[0]), 2) + Math.pow((start_coor[1] - end_coor[1]), 2)));
}

function roundWithTwoDecimals(number) {
    return Math.round(number * 100) / 100;
}

function getCertainPointOnPaths(start_coor, direction, r) {
    return [roundWithTwoDecimals(start_coor[0] + direction[0] * r), roundWithTwoDecimals(start_coor[1] + direction[1] * r)];
}

function api(type, query) {
    var authorization_key = 'GEO1';
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
                        if (data[i]["level"] && data[i]["level"].hasOwnProperty("id")) {
                            if (!rooms_order_after_level.hasOwnProperty(data[i]["level"]["id"])) {
                                rooms_order_after_level[data[i]["level"]["id"]] = [];
                            }
                            if (data[i].hasOwnProperty("no")) {
                                var room = new Room(data[i]);
                                rooms_order_after_level[data[i]["level"]["id"]].push(room)
                                rooms_order_after_roomnr[data[i]["no"]] = room;
                            }
                        } else {
                            // toilets, stairs and elevator
                            if (data[i].hasOwnProperty("category")) {
                                strais_elevators.push(new Elevator_Stairs(data[i]))
                            }
                        }
                    }
                    api("paths", "all");
                } else if (stringsAreEqual(query, "all") && stringsAreEqual(type, "paths")) {
                    for (var i in data) {
                        var level = null;
                        if (data[i]["level"]) {
                            level = data[i]["level"]["id"];
                        } else {
                            level = "*";
                        }
                        if (!paths.hasOwnProperty(level)) {
                            paths[level] = [];
                        }
                        paths[level].push(new Paths(data[i]));
                    }
                    onRoomsLoaded();
                }
            }
        },
        error: function(data) {

            console.log('unable to connect: ' + data);
        }
    });
}

class Elevator_Stairs {
    constructor(json) {
        this.category = Number(json["category"]["id"]);
        this.category_name = this.getCategoryName(json);
        this.door_coordinates = [Number(json["doorX"]), Number(json["doorY"])];
        this.spatial_extend = [
            [json["x1"], json["y1"]],
            [json["x2"], json["y2"]]
        ];
    }

    getCategoryName(json) {
        if (stringsAreEqual(lang, "en")) {
            return json["category"]["name_en"];
        } else if (stringsAreEqual(lang, "es")) {
            return json["category"]["name_es"];
        } else {
            return json["category"]["name_de"];
        }
    }
}


$(function() {
    if (getCookieSupport()) {
        if (document.cookie.indexOf("visited") >= 0) {
            // no instructions needed
        } else {
            //alert(strings["instructions_beginning"][language_index]);
            document.cookie = "visited";
        }
    }
    showLoader();
    storeRoomsOfBuilding();
});

// @source: https://stackoverflow.com/questions/2167310/how-to-show-a-message-only-if-cookies-are-disabled-in-browser/2167462#2167462
// Find out what cookies are supported. Returns:
// null - no cookies
// false - only session cookies are allowed
// true - session cookies and persistent cookies are allowed
// (though the persistent cookies might not actually be persistent, if the user has set
// them to expire on browser exit)
//
function getCookieSupport() {
    var persist = true;
    do {
        var c = 'gCStest=' + Math.floor(Math.random() * 100000000);
        document.cookie = persist ? c + ';expires=Tue, 01-Jan-2030 00:00:00 GMT' : c;
        if (document.cookie.indexOf(c) !== -1) {
            document.cookie = c + ';expires=Sat, 01-Jan-2000 00:00:00 GMT';
            return persist;
        }
    } while (!(persist = !persist));
    return null;
}

function showLoader() {
    document.getElementById("loader").style.display = "block";
    document.getElementById("main_section").style.display = "none";
}

function showMainSection() {
    document.getElementById("loader").style.display = "none";
    document.getElementById("main_section").style.display = "block";
}

function onRoomsLoaded() {
    // rooms from database are loaded
    from_room_object = rooms_order_after_roomnr[from_room];
    to_room_object = rooms_order_after_roomnr[to_room];

    document.title = strings["title_application"][language_index];

    $("#value_label_location").text(strings["destermine_my_position"][language_index] + ":");
    $("#value_label_location").text(strings["destermine_my_position"][language_index] + ":");
    $("#option1_fromroom").text(strings["scan_qr_code_from_room"][language_index]);
    $("#option2_fromroom").text(strings["select_room_on_floorplan"][language_index]);
    $("#option3_fromroom").text(strings["search_list_of_rooms"][language_index]);
    $("#option4_fromroom_section").css("background", "#172154");
    $("#option4_fromroom").text(strings["chose_entry_building"][language_index]);
    $("#value_label_destination").text(strings["destermine_my_destination"][language_index] + ":");
    $("#option1_toroom").text(strings["select_room_on_floorplan"][language_index]);
    $("#option2_toroom").text(strings["search_list_of_rooms"][language_index]);
    $("#label_cancel").text(strings["cancel"][language_index])
    $("#label_next_step").text(strings["next_step"][language_index])
    $("#etagen_btn1").text(strings["floor_1"][language_index])
    $("#etagen_btn2").text(strings["floor_2"][language_index])
    $("#etagen_btn3").text(strings["floor_3"][language_index])
    $("#etagen_btn4").text(strings["floor_4"][language_index])
    $("#etagen_btn5").text(strings["floor_5"][language_index])
    $("#etagen_btn6").text(strings["floor_6"][language_index])
    $("#etagen_btn7").text(strings["floor_7"][language_index])
    $("#description_qr").html(strings["description_qr"][language_index])
    $("#qr_expl_step1").html(strings["qr_expl_step1"][language_index])
    $("#qr_expl_step2").html(strings["qr_expl_step2"][language_index])
    $("#qr_expl_step3").html(strings["qr_expl_step3"][language_index])
    if (from_room_object) {
        etagen_nummer = from_room_object.level;
        $("#label_from_room").text(strings["from_room"][language_index])
        $("#value_from_room").text(from_room)
            // get level of room
        $("#label_level").text(strings["level"][language_index])
        $("#value_level").text($("#etagen_btn" + Number(from_room_object.level)).text())
        $("#etagen_btn" + Number(from_room_object.level)).removeClass("btn-default").addClass("btn-danger");
        if (!to_room_object) {
            displaySection(1)
            setImageWithoutRoute(from_room_object.level, null);
            $("#next_step").remove();
            $("#label_cancel").text(strings["reset_position"][language_index])
        } else {
            displaySection(3)
                // TODO: set image with route
            calculateRoute(from_room_object, to_room_object);
        }
    } else {
        displaySection(0)
        setImageWithoutRoute(2, null);
        etagen_nummer = 2;
        if (!to_room_object) {
            $(".footer").css("display", "none")
        }
    }
    if (to_room_object) {
        $("#label_to_room").text(strings["to_room"][language_index])
        $("#value_to_room").text(to_room)
        $("#etagen_btn" + (Number(to_room_object.level))).removeClass("btn-default").addClass("btn-success");

        // no autocomplete input needed
        $(".autocomplete").css("display", "none");
    } else {
        $(".scrollmenu").css("display", "none");
        $("#autocomplete_search").attr("placeholder", strings["autocomplete_placeholder"][language_index]);
        var autocomplete_options = [];
        for (var i in rooms_order_after_roomnr) {
            console.log(rooms_order_after_roomnr[i].people.length > 0)
            if (rooms_order_after_roomnr[i].people.length > 0) {
                console.log(rooms_order_after_roomnr[i])
                autocomplete_options.push(i + " - " + rooms_order_after_roomnr[i].people[0] + " - " + rooms_order_after_roomnr[i]["institute"]["name"])
            } else {
                autocomplete_options.push(i + " - " + rooms_order_after_roomnr[i]["institute"]["name"])
            }
        }
        autocomplete(document.getElementById("autocomplete_search"), autocomplete_options, "autocomplete_search");
        $("#autocomplete_search").trigger("change")
    }
    if (!mapfullwidth) {
        $(".cancel_table_field, .next_step_table_field, .cancel_table_field, header").css("padding-bottom", "3%")
        $(".cancel_table_field, .next_step_table_field, .cancel_table_field, header").css("padding-top", "3%")
    }
    if (!smartphone) {
        $('.header').removeClass('header').addClass('header_desktop');
        $('.labels_header_table').removeClass('labels_header_table').addClass('labels_header_table_desktop');
        $('.cancel_table_field').removeClass('cancel_table_field').addClass('cancel_table_field_desktop');
        $('.next_step_table_field').removeClass('next_step_table_field').addClass('next_step_table_field_desktop');
        $('.labels_footer_table').removeClass('labels_footer_table').addClass('labels_footer_table_desktop');
    } else {
        $(".etagen_btn").css("height", "80");
        $(".etagen_btn").css("padding-top", "12");
        $(".etagen_btn").css("font-size", "1.8em");
    }
    var used_height_space = window.innerHeight - ($("#myHeader").height() + document.getElementById('canvas').height + $("#footer_table").height() + 80);
    $(".arrow_table").css("maxHeight", used_height_space);
    $(".arrow_table").css("maxWidth", used_height_space * 6 / 7);
    $(".arrow_images").css("maxWidth", (window.innerHeight - window.innerWidth) / 3);
    if (!to_room_object || !from_room_object) {
        displayInfoBottom(strings["select_room"][language_index])
    }
    $("#myHeader").css("width", window.innerWidth + 30);
    showMainSection();
}

function backButtonPressed() {
    if (from_room_object) {
        displaySection(1);
    } else {
        displaySection(0);
    }
}

// 0: options for location; 1: options for destination; 2: qr code scanner; 3: floor plan; 4: list of rooms
function displaySection(section_index) {
    $("#from_room_options, #to_room_options, #floor_plan_section, .autocomplete").css("display", "none")
    $(".footer").css("display", "block")
    $("#back_button").css("display", "none")
    $("#qr_code_section").css("display", "none");
    switch (section_index) {
        case 0:
            // options for location
            $("#from_room_options").css("display", "block")
            $(".footer").css("display", "none")
            break;
        case 1:
            // options for destination
            $("#to_room_options").css("display", "block")
            break;
        case 2:
            // qr code scanner
            $("#back_button").css("display", "block")
            $("#qr_code_section").css("display", "block");
            $(".footer").css("display", "none")
            break;
            let scanner = new Instascan.Scanner({ video: document.getElementById('preview') });
            scanner.addListener('scan', function(content) {
                window.location = content;
            });
            Instascan.Camera.getCameras().then(function(cameras) {
                console.log(JSON.stringify(cameras))
                if (cameras.length > 0) {
                    if (cameras.length > 1) {
                        alert("zwei")
                        scanner.start(cameras[1]);
                    } else {
                        scanner.start(cameras[0]);
                    }
                } else {
                    console.error('No cameras found.');
                }
            }).catch(function(e) {
                console.error(e);
            });

            //$("#from_room_options").css("display", "block")
            break;
        case 3:
            // floor plan
            if (!from_room_object || !to_room_object) {
                $(".footer").css("display", "none")
                $("#back_button").css("display", "block")
            }
            $("#floor_plan_section").css("display", "block")
            break;
        case 4:
            // list of rooms
            if (!from_room_object || !to_room_object) {
                $(".footer").css("display", "none")
                $("#back_button").css("display", "block")
            }
            $(".autocomplete").css("display", "block")
            $("#autocomplete_search").trigger("change")
            setTimeout(function() {
                var event = new Event('input', {
                    bubbles: true,
                    cancelable: true,
                });
                document.getElementById("autocomplete_search").dispatchEvent(event);
            }, 200);
            break;
        default:
            break;
    }
}

function calculateRoute(roomA, roomB) {
    var level_string = roomA.level;
    var detailsPathA = getDetailsOfNearestPath(roomA.door_coordinates, paths[level_string]);
    var detailsPathB = getDetailsOfNearestPath(roomB.door_coordinates, paths[level_string]);

    if (roomA.level == roomB.level) {
        shortest_nav_path1 = getShortestPathBetweenPointsOnPaths(detailsPathA["point"], detailsPathA["path_index"], detailsPathB["point"], detailsPathB["path_index"], paths[level_string], roomA, roomB);
        displayFullNavigation(from_room_object.level, shortest_nav_path1);
    } else {
        // visitor needs to use either the stairs or the elevator
        var two_paths = getShortestPathBetweenPointsOnPathsForDifferentLevels(roomA, roomB);
        console.log(two_paths)
        shortest_nav_path1 = two_paths[0];
        shortest_nav_path2 = two_paths[1];
        if (!only_elevator) {
            $("#elevator_button").attr("src", "symbols/elevator.jpg")
        }
        displayFullNavigation(from_room_object.level, shortest_nav_path1);
    }
    if (shortest_nav_path2) {
        instructions = getInstructionsOfRoutesDifferentLevels(shortest_nav_path1, shortest_nav_path2)
    } else {
        instructions = getInstructionsOfRoutes(shortest_nav_path1)
    }
    for (var k in instructions) {
        if (instructions[k].distance != null) {
            if (instructions[k].distance == 0) {
                $(".scrollmenu").append('<table class="arrow_table"><thead><tr><th colspan="1" align="center"><img style="opacity:0.3" class="center arrow_images" src="' + getArrowFileURLFromRouteInstruction(instructions[k]) + '"></th></tr><tr><th colspan="1" class="large_text distances" style="opacity:0.3">< 1 m</th></tr></thead></table>');
            } else {
                $(".scrollmenu").append('<table class="arrow_table"><thead><tr><th colspan="1" align="center"><img style="opacity:0.3" class="center arrow_images" src="' + getArrowFileURLFromRouteInstruction(instructions[k]) + '"></th></tr><tr><th colspan="1" class="large_text distances" style="opacity:0.3">' + instructions[k].distance + ' m</th></tr></thead></table>');
            }
        } else {
            console.log(used_stairs_elevator)
            if (used_stairs_elevator.category == 2) {
                // elevator
                $(".scrollmenu").append('<table class="arrow_table"><thead><tr><th colspan="1" align="center"><img style="opacity:0.3" class="center arrow_images" src="symbols/elevator.jpg"></th></tr><tr><th colspan="1" class="large_text distances" style="opacity:0.3">' + $("#etagen_btn" + Number(to_room_object.level)).text() + '</th></tr></thead></table>');
            } else {
                $(".scrollmenu").append('<table class="arrow_table"><thead><tr><th colspan="1" align="center"><img style="opacity:0.3" class="center arrow_images" src="symbols/stairs.png"></th></tr><tr><th colspan="1" class="large_text distances" style="opacity:0.3">' + $("#etagen_btn" + Number(to_room_object.level)).text() + '</th></tr></thead></table>');
            }
        }
    }
    $(".scrollmenu").find(">:first-child").css("opacity", "1.0");
    document.getElementsByClassName("arrow_images")[0].style.opacity = "1.0";
    document.getElementsByClassName("distances")[0].style.opacity = "1.0";
    readNextStep()
}

if (document.layers) {
    document.captureEvents(Event.KEYDOWN);
}

document.onkeydown = function(evt) {
    var keyCode = evt ? (evt.which ? evt.which : evt.keyCode) : event.keyCode;
    if (keyCode == 13) {
        // For Enter.
        if (from_room_object && to_room_object) {
            nextStepClicked();
        }
    }
    if (keyCode == 8) {
        // For Escape.
        if (from_room_object) {
            cancelClicked();
        }
    } else {
        return true;
    }
};

function getArrowFileURLFromRouteInstruction(route_instruction) {
    var file = "symbols/";
    switch (route_instruction.direction) {
        case 0:
            //left
            file += "arrow_left";
            break;
        case 1:
            //right
            file += "arrow_right";
            break;
        case 2:
            //up
            file += "arrow_up";
            break;
        default:
            break;
    }
    if (route_instruction.from_qr_code) file += "_qr";
    return file + ".png";
}


function getInstructionsOfRoutes(routes) {
    var instructions = [];
    for (var i = 0; i < routes.length - 2; i++) {
        var dir = getRelativeDirectionOfDecisionPoint(routes[i].startPoint, routes[i].endPoint, routes[i + 1].endPoint, routes[i].from_qr_code);
        var distance = routes[i + 1].distance
        instructions.push(new RouteInstruction(dir, distance, routes[i + 1].endPoint, routes[i].from_qr_code))
    }
    return instructions;
}

function getInstructionsOfRoutesDifferentLevels(routes1, routes2) {
    var instructions = [];
    for (var i = 0; i < routes1.length - 2; i++) {
        var dir = getRelativeDirectionOfDecisionPoint(routes1[i].startPoint, routes1[i].endPoint, routes1[i + 1].endPoint, routes1[i].from_qr_code);
        var distance = routes1[i + 1].distance
        instructions.push(new RouteInstruction(dir, distance, routes1[i + 1].endPoint, routes1[i].from_qr_code))
    }
    instructions.push(new RouteInstruction(null, null, null, null));
    if (stairsWithDirectPathChosen()) {
        instructions.push(new RouteInstruction(2, routes2[0].distance, routes2[0].endPoint, false))
    }
    for (var i = 0; i < routes2.length - 2; i++) {
        var dir = getRelativeDirectionOfDecisionPoint(routes2[i].startPoint, routes2[i].endPoint, routes2[i + 1].endPoint, routes2[i].from_qr_code);
        var distance = routes2[i + 1].distance
        instructions.push(new RouteInstruction(dir, distance, routes2[i + 1].endPoint, routes2[i].from_qr_code))
    }
    return instructions;
}

function getShortestPathBetweenPointsOnPaths(pointA, pathA_index, pointB, pathB_index, path_array, roomA, roomB) {
    var path_connections = getConectionArrayPaths(path_array);
    var all_possible_paths = getAllPossiblePathsWithoutStarisPathsInMiddle(path_connections, [
        [Number(pathA_index)]
    ], Number(pathB_index), from_room_object.level);
    return getShortestPath(path_array, all_possible_paths, pointA, pointB, roomA, roomB);
}

function getShortestPathBetweenPointsOnPathsForDifferentLevels(roomA, roomB) {
    var pathsLevelA = paths[roomA.level];
    var pathsLevelB = paths[roomB.level];

    var detailsPathA = getDetailsOfNearestPath(roomA.door_coordinates, pathsLevelA);
    var detailsPathB = getDetailsOfNearestPath(roomB.door_coordinates, pathsLevelB);
    var min_distance = 1000; // unrealistic maximal distance
    var min_paths = null;
    for (var i in strais_elevators) {
        if (strais_elevators[i]["category"] == 3) continue; // ignore toilettes
        if (only_elevator && strais_elevators[i]["category"] == 1) continue;
        var detailsPathC_levelA = getDetailsOfNearestPath(strais_elevators[i].door_coordinates, pathsLevelA);
        var detailsPathC_levelB = getDetailsOfNearestPath(strais_elevators[i].door_coordinates, pathsLevelB);
        if (distanceBetweenTwoPoints(strais_elevators[i].door_coordinates, detailsPathC_levelB["point"]) > 10) {
            // stairs or elevator finds no shortest path
            continue;
        }
        var all_possible_pathsA = getAllPossiblePathsWithoutStarisPathsInMiddle(getConectionArrayPaths(pathsLevelA), [
            [Number(detailsPathA["path_index"])]
        ], Number(detailsPathC_levelA["path_index"]), from_room_object.level);
        var all_possible_pathsB = getAllPossiblePathsWithoutStarisPathsInMiddle(getConectionArrayPaths(pathsLevelB), [
            [Number(detailsPathC_levelB["path_index"])]
        ], Number(detailsPathB["path_index"]), to_room_object.level);
        var spath = getShortestPathDifferentLevels(detailsPathA, detailsPathB, all_possible_pathsA, all_possible_pathsB, strais_elevators[i], roomA, roomB, detailsPathC_levelA);
        var tmp_distance = 0;
        for (var k in spath[0]) {
            tmp_distance += spath[0][k].distance;
        }
        for (var o in spath[1]) {
            tmp_distance += spath[1][o].distance;
        }
        if (tmp_distance < min_distance) {
            used_stairs_elevator = strais_elevators[i];
            min_distance = tmp_distance;
            min_paths = spath;
        }
    }
    return min_paths;
}

function getShortestPathDifferentLevels(detailsPathA, detailsPathB, all_possible_pathsA, all_possible_pathsB, stairs_elevator, roomA, roomB, detailsPathC) {
    var shortest_path = [];

    var detailsPath1 = shortestPathGetInfos(all_possible_pathsA, paths[roomA.level], detailsPathA["point"], detailsPathC["point"], roomA, stairs_elevator, false)

    var detailsPath2 = shortestPathGetInfos(all_possible_pathsB, paths[roomB.level], detailsPathC["point"], detailsPathB["point"], stairs_elevator, roomB, true)
    shortest_path = [detailsPath1, detailsPath2];
    return shortest_path;
}

function shortestPathGetInfos(all_possible_paths, all_paths, pointA, pointB, roomA, roomB, from_room_is_elevator) {
    var distance_path = 1000; // unrealistic maximal distance
    var output = []
    for (var k in all_possible_paths) {
        var tmp_shortestPath = [];

        if (all_possible_paths[k].length < 2) {
            if (distanceBetweenTwoPoints(roomA.door_coordinates, pointA) > 0) {
                output.push(new Route(roomA.door_coordinates, pointA, true, false, !from_room_is_elevator))
            }
            output.push(new Route(pointA, pointB, false, false));
            output.push(new Route(pointB, roomB.door_coordinates, false, true, false));
            return output;
        }
        var tmp_point2 = 0;
        var tmp_point = pointWherePathsAreConnected(all_paths[all_possible_paths[k][0]], all_paths[all_possible_paths[k][1]]);
        if (distanceBetweenTwoPoints(roomA.door_coordinates, pointA) > 0) {
            tmp_shortestPath.push(new Route(roomA.door_coordinates, pointA, true, false, !from_room_is_elevator))
        }
        tmp_shortestPath.push(new Route(pointA, tmp_point, false, false, false));
        for (var i = 1; i < all_possible_paths[k].length - 1; i++) {
            tmp_point2 = pointWherePathsAreConnected(all_paths[all_possible_paths[k][i]], all_paths[all_possible_paths[k][i + 1]]);
            tmp_shortestPath.push(new Route(tmp_point, tmp_point2, false, false, false));
            tmp_point = tmp_point2;
        }
        tmp_shortestPath.push(new Route(tmp_point, pointB, false, false, false));
        tmp_shortestPath.push(new Route(pointB, roomB.door_coordinates, false, true, false));
        var tmp_distance = 0;
        for (var l in tmp_shortestPath) {
            tmp_distance += tmp_shortestPath[l].distance;
        }
        if (tmp_distance < distance_path) {
            distance_path = tmp_distance;
            output = tmp_shortestPath;
        }
    }
    return output;
}

function getShortestPath(all_paths, all_paths_indexes, pointA, pointB, roomA, roomB) {
    var distance_path = 1000; // unrealistic maximal distance
    var shortest_path = [];
    for (var j in all_paths_indexes) {
        var tmp_shortestPath = [];
        if (all_paths_indexes[j].length < 2) {
            shortest_path.push(new Route(roomA.door_coordinates, pointA, true, false, true));
            shortest_path.push(new Route(pointA, pointB, false, false, false));
            shortest_path.push(new Route(pointB, roomB.door_coordinates, false, true, false));
            return shortest_path;
        }
        var tmp_point = pointWherePathsAreConnected(all_paths[all_paths_indexes[j][0]], all_paths[all_paths_indexes[j][1]]);
        tmp_shortestPath.push(new Route(roomA.door_coordinates, pointA, true, false, true));
        tmp_shortestPath.push(new Route(pointA, tmp_point, false, false));
        var tmp_point2 = null;
        for (var i = 1; i < all_paths_indexes[j].length - 1; i++) {
            tmp_point2 = pointWherePathsAreConnected(all_paths[all_paths_indexes[j][i]], all_paths[all_paths_indexes[j][i + 1]]);
            tmp_shortestPath.push(new Route(tmp_point, tmp_point2, false, false));
            tmp_point = tmp_point2;
        }
        tmp_shortestPath.push(new Route(tmp_point, pointB, false, false));
        tmp_shortestPath.push(new Route(pointB, roomB.door_coordinates, true, false));
        var tmp_distance = 0;
        for (var l in tmp_shortestPath) {
            tmp_distance += tmp_shortestPath[l].distance;
        }
        if (tmp_distance < distance_path) {
            distance_path = tmp_distance;
            shortest_path = tmp_shortestPath;
        }
    }
    return shortest_path;
}
// returns:
// left: 0; right: 1
function getRelativeDirectionOfDecisionPoint(pointA, pointB, pointC, from_qr_code) {
    var first_dir = getDirectionOfRoute(pointA, pointB);
    var second_dir = getDirectionOfRoute(pointB, pointC);
    if (from_qr_code) {
        first_dir = -first_dir;
    }
    if (first_dir == 1) {
        if (second_dir == -2) {
            return 0;
        } else {
            return 1;
        }
    } else if (first_dir == -1) {
        if (second_dir == -2) {
            return 1;
        } else {
            return 0;
        }
    } else if (first_dir == 2) {
        if (second_dir == 1) {
            return 0;
        } else {
            return 1;
        }
    } else if (first_dir == -2) {
        if (second_dir == 1) {
            return 1;
        } else {
            return 0;
        }
    }
}

// returns:
// top: 1; right: 2; bottom: -1; left: -2
function getDirectionOfRoute(from_point, to_point) {
    var x = roundWithTwoDecimals(to_point[0]) - roundWithTwoDecimals(from_point[0])
    var y = roundWithTwoDecimals(to_point[1]) - roundWithTwoDecimals(from_point[1])
    if (x != 0) {
        if (x > 0) {
            return 2;
        } else {
            return -2;
        }
    }
    if (y != 0) {
        if (y > 0) {
            return -1;
        } else {
            return 1;
        }
    }
}

function getAllPossiblePathsWithoutStarisPathsInMiddle(connections, path_lines, destiny_path_index, level) {
    var ignore_path_with = null;
    if (pathsIsOnlyForElevator(level)) {
        ignore_path_with = Number(pathsIsOnlyForElevator(level)["path_index"]);
    }
    var poss_paths = getAllPossiblePaths(connections, path_lines, destiny_path_index);
    var delete_paths = []
    var output = []
    for (var i in poss_paths) {
        for (var j = 1; j < poss_paths[i].length - 1; j++) {
            if (poss_paths[i][j] == ignore_path_with) {
                delete_paths.push(i);
            }
        }
    }
    for (var k in poss_paths) {
        if (delete_paths.indexOf(k) == -1) {
            output.push(poss_paths[k])
        }
    }
    if (output.length == 0) {
        console.log(poss_paths)
    }
    return output;
}

function getAllPossiblePaths(connections, path_lines, destiny_path_index) {
    var all_routes_finsihed = true;
    for (var j in path_lines) {
        if (path_lines[j][path_lines[j].length - 1] != destiny_path_index) {
            all_routes_finsihed = false;
            var direct_con = getAllDirectConnections(connections, path_lines[j][path_lines[j].length - 1]);
            for (var i in direct_con) {
                if (path_lines[j].indexOf(direct_con[i]) > -1) {
                    // path will not be considered
                } else {
                    // path reached destination
                    var tmp = [];
                    for (var k in path_lines[j]) {
                        tmp.push(path_lines[j][k])
                    }
                    tmp.push((direct_con[i]));
                    path_lines.push(tmp)
                }
            }
            path_lines.splice(j, 1);
        }
    }
    if (all_routes_finsihed) {
        return path_lines;
    } else {
        return getAllPossiblePaths(connections, path_lines, destiny_path_index)
    }
}

function getAllDirectConnections(connections, path_index) {
    var paths = [];
    for (var i in connections) {
        if (connections[i][0] == path_index && paths.indexOf(connections[i][1]) < 0) {
            paths.push(connections[i][1]);
        } else if (connections[i][1] == path_index && paths.indexOf(connections[i][0]) < 0) {
            paths.push(connections[i][0]);
        }
    }
    return paths
}

function pathsInConnectedPathArray(pathA_index, pathB_index, connected_paths) {
    for (var i in connected_paths) {
        if (connected_paths[i].indexOf(Number(pathA_index)) > -1 &&
            connected_paths[i].indexOf(Number(pathB_index)) > -1) {
            return true;
        }
    }
    return false;
}

function getConectionArrayPaths(path_array) {
    var connected_paths = [];
    for (var i in path_array) {
        for (var j in path_array) {
            if (i != j && pointWherePathsAreConnected(path_array[i], path_array[j]) &&
                !pathsInConnectedPathArray(i, j, connected_paths)) {
                connected_paths.push([Number(i), Number(j)]);
            }
        }
    }
    return connected_paths;
}

function pointWherePathsAreConnected(pathA, pathB) {
    var inter = line_intersect(pathA.startPoint[0], pathA.startPoint[1], pathA.endPoint[0], pathA.endPoint[1],
        pathB.startPoint[0], pathB.startPoint[1], pathB.endPoint[0], pathB.endPoint[1]);
    if (inter)  {
        return [inter["x"], inter["y"]];
    } else {
        return null
    }
}

// @source: https://stackoverflow.com/questions/13937782/calculating-the-point-of-intersection-of-two-lines
function line_intersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    var ua, ub, denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (denom == 0) {
        return null;
    }
    ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
    if (ub < 0) return null;
    if (ua < 0) return null; // own modification: only consider points that are within the line (not like a vector)
    if (!(ua >= 0 && ua <= 1) || !(ub >= 0 && ub <= 1)) return null;
    return {
        x: x1 + ua * (x2 - x1),
        y: y1 + ua * (y2 - y1),
        seg1: ua >= 0 && ua <= 1,
        seg2: ub >= 0 && ub <= 1
    };
}

function displayRouteTrial(level, points_on_route) {
    var canvas = document.getElementById('canvas');
    if (!mapfullwidth) screen_width = window.innerWidth * scale_desktop_version_canvas; // Desktop Version
    canvas.width = screen_width;
    canvas.height = screen_width;
    var img = new Image();
    img.onload = function() {
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, screen_width, screen_width);
        displayRouteBetweenPoints(ctx, points_on_route, canvas.width, canvas.height);
    };
    img.src = getImageURLForLevel(level);
}

function displayFullNavigation(level, shortest_path, second_paths) {
    var canvas = document.getElementById('canvas');
    if (!mapfullwidth) screen_width = window.innerWidth * scale_desktop_version_canvas; // Desktop Version
    canvas.width = screen_width;
    canvas.height = screen_width;
    var img = new Image();
    img.onload = function() {
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, screen_width, screen_width);
        if (current_step == shortest_path.length - 1) {
            if (shortest_nav_path2 && !second_route) {} else {
                highLightRoom(ctx, to_room_object.spatial_extend, canvas.width, canvas.height, "rgba(0, 100, 0, 0.6)")
            }
        } else {
            if (shortest_nav_path2 && !second_route) {} else {
                highLightRoom(ctx, to_room_object.spatial_extend, canvas.width, canvas.height, "rgba(0, 100, 0, 0.2)")
            }
        }
        if (shortest_nav_path2 && !second_route) {
            // draw circle at the destination
            drawCircle(ctx, used_stairs_elevator.door_coordinates[0] * canvas.width / 100, used_stairs_elevator.door_coordinates[1] * canvas.height / 100, "rgba(34,139,34, 0.6)")
        } else {
            drawCircle(ctx, to_room_object.door_coordinates[0] * canvas.width / 100, to_room_object.door_coordinates[1] * canvas.height / 100, "rgba(34,139,34, 0.6)")
        }
        for (var i in paths[to_room_object.level]) {
            //drawLineRelative(ctx, paths[to_room_object.level][i].startPoint, paths[to_room_object.level][i].endPoint, canvas.width, canvas.height, "orange")
        }
        if (level == from_room_object.level) {
            writeRoomNr(ctx, from_room_object, canvas.width, canvas.height);
        }
        if (level == to_room_object.level) {
            writeRoomNr(ctx, to_room_object, canvas.width, canvas.height);
        }
        if (current_step != shortest_path.length - 1) {
            var location_arrow = new Image;
            location_arrow.onload = function() {
                var arrow_size = 60;
                if (current_step == 0) {
                    console.log(shortest_path)
                        //ctx.drawImage(location_arrow, shortest_path[current_step].startPoint[0] * canvas.width / 100 - arrow_size / 2, shortest_path[current_step].startPoint[1] * canvas.width / 100 - arrow_size / 2, arrow_size, arrow_size);
                    drawCircle(ctx, shortest_path[0].startPoint[0] * canvas.width / 100, shortest_path[0].startPoint[1] * canvas.height / 100, "red")
                } else {
                    ctx.drawImage(location_arrow, shortest_path[current_step].startPoint[0] * canvas.width / 100 - arrow_size / 2, shortest_path[current_step].startPoint[1] * canvas.width / 100 - arrow_size / 2, arrow_size, arrow_size);
                }
            }
            if (shortest_path[current_step].from_qr_code) {
                location_arrow.src = "symbols/location_arrow" + getDirectionOfRoute(shortest_path[current_step].endPoint, shortest_path[current_step].startPoint) + ".png";
            } else {
                if (shortest_path[current_step - 1]) {
                    location_arrow.src = "symbols/location_arrow" + getDirectionOfRoute(shortest_path[current_step - 1].startPoint, shortest_path[current_step - 1].endPoint) + ".png";
                } else {
                    location_arrow.src = "symbols/location_arrow" + getDirectionOfRoute(shortest_path[current_step].startPoint, shortest_path[current_step].endPoint) + ".png";
                }
            }
        }
        displayRouteBetweenPoints(ctx, shortest_path, canvas.width, canvas.height);
    };
    img.src = getImageURLForLevel(level);
}

function elevator_symbol_pressed() {
    if (confirm(strings["question_only_elevator"][language_index])) {
        setOnlyElev(true);
    }
}

function pathsIsOnlyForElevator(level) {
    var output = null;
    for (var i in strais_elevators) {
        if (getDetailsOfNearestPath(strais_elevators[i].door_coordinates, paths[level])["distance"] == 0) {
            output = getDetailsOfNearestPath(strais_elevators[i].door_coordinates, paths[level]);
        }
    }
    return output;
}

function stairsWithDirectPathChosen() {
    return (getDetailsOfNearestPath(used_stairs_elevator.door_coordinates, paths[to_room_object.level])["distance"] == 0);
}

function nextStepClicked() {
    if (current_step != 0 || (second_route && stairsWithDirectPathChosen())) {
        current_step++;
    } else {
        current_step += 2;
    }
    current_instruction++;
    if (shortest_nav_path2) {
        if (second_route) {
            if (current_step == shortest_nav_path2.length) {
                //new route from old destination
                setFromAndToRoom(to_room_object.room_nr, null);
                return;
            }
        }
    } else {
        if (current_step == shortest_nav_path1.length) {
            //new route from old destination
            setFromAndToRoom(to_room_object.room_nr, null);
            return;
        }
    }
    $(".scrollmenu").find(">:first-child").fadeOut(function() {
        $(".scrollmenu").find(">:first-child").remove()
        if (document.getElementsByClassName("arrow_images").length > 0) {
            document.getElementsByClassName("arrow_images")[0].style.opacity = "1.0";
            document.getElementsByClassName("distances")[0].style.opacity = "1.0";
        }
        readNextStep()
        $("#label_next_step").text(strings["next_step"][language_index])
        if (shortest_nav_path2) {
            if (second_route && current_step == shortest_nav_path2.length - 1) {
                // navigation is finished
                displayFullNavigation(to_room_object.level, shortest_nav_path2)
                navigationFinished();
                return;
            }
            if (current_step < shortest_nav_path1.length || second_route && (current_step < shortest_nav_path2.length)) {
                if (second_route) {
                    displayFullNavigation(to_room_object.level, shortest_nav_path2)
                } else {
                    displayFullNavigation(from_room_object.level, shortest_nav_path1)
                }
            } else {
                second_route = true;
                current_step = 0;
                displayFullNavigation(to_room_object.level, shortest_nav_path2, true)
            }
            if (!second_route) {
                if (current_step == shortest_nav_path1.length - 1) {
                    $("#label_next_step").text(($("#etagen_btn" + Number(to_room_object.level)).text()) + " " + strings["reached"][language_index]);
                }
            }
        } else {
            displayFullNavigation(etagen_nummer, shortest_nav_path1)
            if (current_step == shortest_nav_path1.length - 1) {
                // navigation is finished
                navigationFinished();
            }
        }
    });
}

function navigationFinished() {
    startConfetti()
    $("#arrow").css("display", "none");
    $("#distance").css("margin", "10%");
    $("#distance").css("display", "block");
    $("#cancel").css("display", "none")
    $("#label_next_step").text(strings["new_route_from_here"][language_index])
    displayInfoBottom("<b>" + strings["destination_reached"][language_index] + "</b>");
    var audio = new Audio('success_tone.mp3');
    audio.play();
    setTimeout(function() { stopConfetti(); }, 2000);
}

function getTextNextStep() {
    if (document.getElementsByClassName("distances").length == 0) {
        return strings["destination_reached"][language_index];
    }
    var distance = document.getElementsByClassName("distances")[0].innerHTML.replace("&lt;", strings["less_than"][language_index]).replace(" m", " " + strings["meter"][language_index]);
    if ((document.getElementsByClassName("arrow_images")[0].src + "").includes("left")) {
        direction = "links";
        return strings["please_turn_and_go"][language_index].replace("%s1", strings["left"][language_index]).replace("%s2", distance);
    } else if ((document.getElementsByClassName("arrow_images")[0].src + "").includes("right")) {
        return strings["please_turn_and_go"][language_index].replace("%s1", strings["right"][language_index]).replace("%s2", distance);
    } else if ((document.getElementsByClassName("arrow_images")[0].src + "").includes("up")) {
        return strings["walk_direction_arrow"][language_index].replace("%s1", distance);
    } else {
        if (!used_stairs_elevator) return "";
        // change level
        if (used_stairs_elevator.category == 1) {
            // stairs
            return strings["take_stairs_elevator"][language_index].replace("%s1", strings["the_stairs"][language_index]).replace("%s2", strings["name_floor_" + to_room_object.level][language_index]);
        } else {
            // elevator
            return strings["take_stairs_elevator"][language_index].replace("%s1", strings["the_elevator"][language_index]).replace("%s2", strings["name_floor_" + to_room_object.level][language_index]);
        }
    }
}

function readNextStep() {
    readText(getTextNextStep());
}

function readText(text) {
    var msg = new SpeechSynthesisUtterance(text);
    if (language_index == 1) {
        msg.lang = 'en-GB';
        //responsiveVoice.speak(text, "UK English Male", { rate: 0.8 });
    } else {
        msg.lang = 'de-DE';
        //responsiveVoice.speak(text, "Deutsch Female", { rate: 0.8 });
    }
    window.speechSynthesis.speak(msg);
}

function displayInfoBottom(html_text) {
    $("#info").css("margin", "5%");
    $("#info").html(html_text);
}

function displayRouteBetweenPoints(ctx, full_path, imageWidth, imageHeigth) {
    ctx.beginPath();
    var i = current_step;
    if (i == full_path.length - 1) i = full_path.length;
    for (i; i < full_path.length; i++) {
        var plus_X = 0;
        var plus_Y = 0;
        if (full_path[i].startPoint[0] == full_path[i].endPoint[0]) {
            plus_Y = 2.5;
            if ((full_path[i].endPoint[1] - full_path[i].startPoint[1]) < 0) plus_Y = -plus_Y;
        } else {
            plus_X = 2.5;
            if ((full_path[i].endPoint[0] - full_path[i].startPoint[0]) < 0) plus_X = -plus_X;
        }
        ctx.moveTo(full_path[i].startPoint[0] * imageWidth / 100, full_path[i].startPoint[1] * imageHeigth / 100);
        ctx.lineTo(full_path[i].endPoint[0] * imageWidth / 100 + plus_X, full_path[i].endPoint[1] * imageHeigth / 100 + plus_Y);
    }
    ctx.lineWidth = 8;
    ctx.strokeStyle = "red";
    ctx.stroke();
}

function getDetailsOfNearestPath(point, path_array) {
    var min_distance = 100; // maximal possible distance in graph
    var min_point = null;
    var min_path = null;
    for (var i in path_array) {
        var tmp_point = getNearestPointOnPath(point, path_array[i]);
        var tmp_dist = distanceBetweenTwoPoints(point, tmp_point);
        if (tmp_dist < min_distance) {
            min_point = tmp_point;
            min_distance = tmp_dist;
            min_path = i;
        }
    }
    return {
        "point": min_point,
        "path_index": min_path,
        "distance": min_distance
    };
}

function cancelClicked() {
    if (to_room_object) {
        setToRoom(null);
    } else {
        setFromRoom(null);
    }
}

function storeRoomsOfBuilding() {
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
    if (from_room_object && to_room_object) {
        // navigation is displayed - disable buttons
        return;
    }
    etagen_nummer = Number(this.id.replace("etagen_btn", ""))
    if (from_room_object && to_room_object) {
        displayFullNavigation(etagen_nummer, shortest_nav_path1);
    } else {
        setImageWithoutRoute(etagen_nummer, null)
    }
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
    var canvas = document.getElementById('canvas');
    if (!mapfullwidth) screen_width = window.innerWidth * scale_desktop_version_canvas; // Desktop Version
    canvas.width = screen_width;
    canvas.height = screen_width;
    var img = new Image();
    img.onload = function() {
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, screen_width, screen_width);
        if (from_room_object && etagen_nummer == from_room_object.level) {
            // draw circle at the current position of the user
            drawCircle(ctx, from_room_object.door_coordinates[0] * canvas.width / 100, from_room_object.door_coordinates[1] * canvas.height / 100, "rgba(255, 0, 0, 0.6)")
        }
        if (to_room_object && etagen_nummer == to_room_object.level) {
            // draw circle at the destination
            drawCircle(ctx, to_room_object.door_coordinates[0] * canvas.width / 100, to_room_object.door_coordinates[1] * canvas.height / 100, "rgba(34,139,34, 0.6)")
        }
        for (var i in rooms_order_after_level[level]) {
            highLightRoom(ctx, rooms_order_after_level[level][i].spatial_extend, canvas.width, canvas.height, "rgba(0, 100, 0, 0.1)")
            writeRoomNr(ctx, rooms_order_after_level[level][i], canvas.width, canvas.height)
        }
        for (var i in paths[level]) {
            //drawLineRelativeWidth(ctx, paths[level][i].startPoint, paths[level][i].endPoint, canvas.width, canvas.height, "rgba(190,190,190,0.4)", 1)
        }
        if (roomHighlighted) {
            highLightRoom(ctx, roomHighlighted.spatial_extend, canvas.width, canvas.height, "rgba(0, 100, 0, 0.5)")
        }
    };
    img.src = getImageURLForLevel(level);
}

function writeRoomNr(ctx, room_object, width, height) {
    if (room_object.width < 8) {
        canvasWriteText(ctx, room_object.spatial_extend, width, height, room_object.room_nr, 20, 15, 7)
    } else {
        canvasWriteText(ctx, room_object.spatial_extend, width, height, room_object.room_nr, 25, 22, 10)
    }
}

function canvasWriteText(ctx, spatial_extend, cvwidth, cvheight, text, text_size, shift_X_minus, shift_Y_plus) {
    ctx.font = text_size + "px Arial";
    ctx.fillStyle = "rgb(0,0,0)"
    ctx.fillText(text, (spatial_extend[0][0] + spatial_extend[1][0]) / 2 * cvwidth / 100 - shift_X_minus, (spatial_extend[0][1] + spatial_extend[1][1]) / 2 * cvheight / 100 + shift_Y_plus);
}

function highLightRoom(ctx, spatial_extend, cvwidth, cvheight, color) {
    ctx.beginPath();
    ctx.rect(spatial_extend[0][0] * cvwidth / 100, spatial_extend[0][1] * cvheight / 100, (spatial_extend[1][0] - spatial_extend[0][0]) * cvwidth / 100, (spatial_extend[1][1] - spatial_extend[0][1]) * cvheight / 100);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
}

function drawCircle(ctx, centerX, centerY, color_string) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, 17, 0, 2 * Math.PI, false);
    ctx.fillStyle = color_string;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#003300';
    ctx.stroke();
}

var canvas = document.querySelector('canvas');
canvas.addEventListener('click', function(e) {
    if (to_room_object && from_room_object) {
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
            setImageWithoutRoute(etagen_nummer, room_obj)
            $("#room_details").css("display", "block");
            $("#info").html("");
            currently_selected_room = room_obj;
            if (room_obj.room_nr.length == 0 && room_obj.description.length > 0) {
                if (from_room_object) {
                    var html = "<btn class='button_room_select' onclick='setToRoomCurrentlySelected()'>=> " + strings["navigate_to_room"][language_index] + "</btn>" + "<b>";
                    $("#room_details").html(html);
                } else {
                    var html = "<btn class='button_room_select' onclick='setFromRoomCurrentlySelected()'>=> " + strings["start_from_here"][language_index] + "</btn>" + "<b>";
                    $("#room_details").html(html);
                }
            } else {
                var end_html = "";
                if (room_obj.people.length > 0) {
                    end_html += '<br><b>' + strings["staff"][language_index] + ": </b>" + room_obj.people[0];
                }
                if (from_room_object) {
                    var html = "<btn class='button_room_select' onclick='setToRoomCurrentlySelected()'>=> " + strings["navigate_to_room"][language_index] + "</btn>" + "<b>";
                    $("#room_details").html(html + "<div style='padding:20px;background: orange; font-size: 2.5em;'>" + "</b><b>" + strings["room_nr"][language_index] + ":</b> " + String(room_obj.room_nr) + '<br><b>' + strings["institute"][language_index] + ": </b>" + room_obj.institute["name"] + end_html + "</div>");
                } else {
                    var html = "<btn class='button_room_select' onclick='setFromRoomCurrentlySelected()'>=> " + strings["start_from_here"][language_index] + "</btn>" + "<b>";
                    $("#room_details").html(html + "<div style='padding:20px;background: orange; font-size: 2.5em;'>" + "</b><b>" + strings["room_nr"][language_index] + ":</b> " + String(room_obj.room_nr) + '<br><b>' + strings["institute"][language_index] + ": </b>" + room_obj.institute["name"] + end_html + "</div>");
                }
            }
        }
    }
    for (var i in strais_elevators) {
        if (pointIsWithinSpatialExtend([mouseX, mouseY], strais_elevators[i].spatial_extend)) {
            $("#room_details").css("display", "block");
            $("#info").html("");
            setImageWithoutRoute(etagen_nummer, strais_elevators[i]);
            if (from_room_object) {
                $("#room_details").html("<div style='padding:20px;background: orange; font-size: 2.5em;'>" + "</b><b>" + strings["category"][language_index] + ":</b> " + strais_elevators[i].category_name + '<br><b>' + strings["institute"][language_index] + ": </b>" + room_obj.institute["name"] + "</div>");
            } else {
                $("#room_details").html("<div style='padding:20px;background: orange; font-size: 2.5em;'>" + "</b><b>" + strings["category"][language_index] + ":</b> " + strais_elevators[i].category_name + '<br><b>' + strings["institute"][language_index] + ": </b>" + room_obj.institute["name"] + "</div>");
            }
        }
    }
});

function setFromRoomCurrentlySelected() {
    setFromRoom(currently_selected_room.room_nr)
}

function setToRoomCurrentlySelected() {
    setToRoom(currently_selected_room.room_nr)
}

function pointIsWithinSpatialExtend(point, spatial_extend) {
    if (point[0] >= spatial_extend[0][0] && point[0] <= spatial_extend[1][0] &&
        point[1] >= spatial_extend[0][1] && point[1] <= spatial_extend[1][1]) {
        return true;
    } else {
        return false;
    }
}

function getImageURLForLevel(level) {
    var img_name = "0.png"; // default value
    switch (level) {
        case "1":
        case 1:
            img_name = "-1.png";
            break;
        case "2":
        case 2:
            img_name = "0.png";
            break;
        case "3":
        case 3:
            img_name = "1.png";
            break;
        case "4":
        case 4:
            img_name = "2.png";
            break;
        case "5":
        case 5:
            img_name = "3.png";
            break;
        case "6":
        case 6:
            img_name = "4.png";
            break;
        case "7":
        case 7:
            img_name = "5.png";
            break;
        default:
            break;
    }
    return to_floor_plans_folder + img_name;

}

function setOnlyElev(onlyelev) {
    var current_loc = window.location + "";
    var end_loc = "";
    if (current_loc.indexOf(".html") > -1) {
        end_loc = current_loc.substr(0, current_loc.indexOf(".html") + 5) + "?" + language_param_str + "=" + lang;
    } else {
        end_loc = current_loc.substr(0, current_loc.lastIndexOf("/")) + "?" + language_param_str + "=" + lang;
    }
    if (from_room) {
        end_loc += "&" + from_room_param_str + "=" + from_room;
    }
    if (to_room_object) {
        end_loc += "&" + to_room_param_str + "=" + to_room_object.room_nr;
    }
    if (onlyelev) {
        end_loc += "&" + only_elevator_param_str + "=" + 1;
    }
    window.location = end_loc;
}


function setToRoom(to_room_number) {
    var current_loc = window.location + "";
    var end_loc = "";
    if (current_loc.indexOf(".html") > -1) {
        end_loc = current_loc.substr(0, current_loc.indexOf(".html") + 5) + "?" + language_param_str + "=" + lang;
    } else {
        end_loc = current_loc.substr(0, current_loc.lastIndexOf("/")) + "?" + language_param_str + "=" + lang;
    }
    if (from_room) {
        end_loc += "&" + from_room_param_str + "=" + from_room;
    }
    if (to_room_number) {
        end_loc += "&" + to_room_param_str + "=" + to_room_number;
    }
    window.location = end_loc;
}

function setFromAndToRoom(from_room_number, to_room_number) {
    var current_loc = window.location + "";
    var end_loc = "";
    if (current_loc.indexOf(".html") > -1) {
        end_loc = current_loc.substr(0, current_loc.indexOf(".html") + 5) + "?" + language_param_str + "=" + lang;
    } else {
        end_loc = current_loc.substr(0, current_loc.lastIndexOf("/")) + "?" + language_param_str + "=" + lang;
    }
    if (to_room_number) {
        end_loc += "&" + to_room_param_str + "=" + to_room_number;
    }
    if (from_room_number) {
        end_loc += "&" + from_room_param_str + "=" + from_room_number;
    }
    window.location = end_loc;
}

function setFromRoom(from_room_number) {
    var current_loc = window.location + "";
    var end_loc = "";
    if (current_loc.indexOf(".html") > -1) {
        end_loc = current_loc.substr(0, current_loc.indexOf(".html") + 5) + "?" + language_param_str + "=" + lang;
    } else {
        end_loc = current_loc.substr(0, current_loc.lastIndexOf("/")) + "?" + language_param_str + "=" + lang;
    }
    if (to_room) {
        end_loc += "&" + to_room_param_str + "=" + to_room;
    }
    if (from_room_number) {
        end_loc += "&" + from_room_param_str + "=" + from_room_number;
    }
    window.location = end_loc;
}


function autocomplete(inp, arr, id) {
    /* source: https://www.w3schools.com/howto/howto_js_autocomplete.asp
    the autocomplete function takes two arguments,
    the text field element and an array of possible autocompleted values:*/
    var currentFocus;
    /*execute a function when someone writes in the text field:*/
    inp.addEventListener("input", function(e) {
        var a, b, i, val = this.value;
        /*close any already open lists of autocompleted values*/
        closeAllLists();
        if (!val) { return instantAutocomplete(); }
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
                    if (from_room_object) {
                        setToRoom(inp.value.substr(0, inp.value.indexOf("-")).replace(" ", ""));
                    } else {
                        setFromRoom(inp.value.substr(0, inp.value.indexOf("-")).replace(" ", ""));
                    }
                });
                a.appendChild(b);
            }
        }
    });

    function instantAutocomplete() {
        var a, b, i, val = inp.value;
        /*close any already open lists of autocompleted values*/
        closeAllLists();
        //if (!val) { return false; }
        currentFocus = -1;
        /*create a DIV element that will contain the items (values):*/
        a = document.createElement("DIV");
        a.setAttribute("id", inp.id + "autocomplete-list");
        a.setAttribute("class", "autocomplete-items");
        /*append the DIV element as a child of the autocomplete container:*/
        inp.parentNode.appendChild(a);
        /*for each item in the array...*/
        for (i = 0; i < arr.length; i++) {
            /*check if the item starts with the same letters as the text field value:*/
            //here
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
                if (from_room_object) {
                    setToRoom(inp.value.substr(0, inp.value.indexOf("-")).replace(" ", ""));
                } else {
                    setFromRoom(inp.value.substr(0, inp.value.indexOf("-")).replace(" ", ""));
                }
            });
            a.appendChild(b);
        }
    }

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