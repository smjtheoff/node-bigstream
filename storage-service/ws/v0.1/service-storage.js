var ctx = require('../../../context');

var express = require('express');
var router = express.Router();
var path = require('path');
var fs = require('fs');
var async = require('async');

var cfg = ctx.config;
var response = ctx.getlib('lib/ws/response');
var request = ctx.getlib('lib/ws/request');
var BinStream = ctx.getlib('lib/storage/binarystream_v1_0');
var ObjId = ctx.getlib('lib/storage/objid');

router.get('/:id/stats',function (req, res) {
    var reqHelper = request.create(req);
    var respHelper = response.create(res);
    var sid = req.params.id;

    if(!sid){
      return respHelper.response404();
    }

    var storage_path = sid.split('.').join('/');
    var bss_full_path = cfg.repository.path + "/" + storage_path + ".bss";

    fs.exists(bss_full_path,function(exists){

      if(exists){
        BinStream.open(bss_full_path,function(err,bss){
          var rd = bss.reader();
          var obj_stat = {
            "storagename" : sid,
            "count" : rd.count(),
            "filename" : storage_path + ".bss"
          }
          bss.close(function(err){
            respHelper.responseOK(obj_stat);
          });
        });
      }else{
        respHelper.response404();
      }

    });

});

router.get('/:id/objects',function (req, res) {
    var reqHelper = request.create(req);
    var respHelper = response.create(res);
    var sid = req.params.id;
    var query = reqHelper.getQuery();

    if(!query){query={};}

    if(!sid){
      return respHelper.response404();
    }

    var storage_path = sid.split('.').join('/');
    var bss_full_path = cfg.repository.path + "/" + storage_path + ".bss";

    var from_seq = 1;
    var limit = 0;

    if(query.obj_after){
      var o_seq;
      try{
        var obj_id = new ObjId(query.obj_after);
        o_seq = obj_id.extract().seq;
      }catch(err){
        return respHelper.response404();
      }
      from_seq = o_seq+1;
    }

    if(query.limit){
      limit = Number(query.limit);
    }

    if(query.seq_from){
      from_seq = Number(query.seq_from);
    }

    fs.exists(bss_full_path,function(exists){

      if(exists){

        BinStream.open(bss_full_path,function(err,bss){
          var rd = bss.reader();
          var rec_count = rd.count();
          if(query.last){
            var last_count=Number(query.last);
            from_seq = (rec_count - last_count) + 1;
          }
          if(from_seq<1){from_seq=1;}

          var idx = from_seq;
          var obj_return = [];

          var cont = true;
          if(idx > rec_count){cont=false;}

          rd.moveTo(idx);
          async.whilst(
              function() { return cont; },
              function(callback){
                rd.nextObject(function(err,obj){
                  idx++;
                  if(!obj){
                    cont=false;
                  }else{
                    //console.log(obj);
                    obj_return.push(obj_out(obj));
                    if(limit>0 && idx>=from_seq+limit){
                      cont=false;
                    }
                  }
                  callback();
                });
              },function(err){
                bss.close(function(err){
                  respHelper.responseOK(obj_return);
                });
              });

        });

      }else{
        respHelper.response404();
      }

    });

});

function obj_out(obj){
  return {"_id" : (new ObjId(obj.header.ID)).toString(),
          "meta" : obj.meta,
          "data" : obj.data
        }
}


module.exports = router;